# Contribuir a `@eva_solutions/whatsapp-sdk`

## Preparar el entorno

Requisitos: Node 22+ y pnpm `11.28.2` (declarado en `packageManager`).

```bash
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm run test:run
pnpm run build
```

Si esos cuatro pasan, la base está sana. Tras `build`, `pnpm run publint` y `pnpm run attw` revisan el paquete armado (exports, tipos ESM/CJS); CI también los corre. `pnpm run format` aplica `oxfmt`. Los scripts disponibles están en [docs/configuration.md](./docs/configuration.md#2-como-contribuidor).

> `pnpm-workspace.yaml` aprueba el script de instalación de `esbuild` (`allowBuilds`). pnpm 11 no ejecuta scripts de dependencias sin aprobación explícita.

## Flujo de un cambio

1. Crea una rama desde `development`: `git switch -c feat/descripcion-corta`.
2. Sigue las convenciones de [docs/conventions.md](./docs/conventions.md): Result Pattern, validación local, `segmentoRuta`, imports por barrel.
3. Agrega o actualiza tests (`*.mock.test.ts`, sin red) para que la suite pase y el comportamiento nuevo quede cubierto.
4. Actualiza la documentación afectada en el mismo cambio: `docs/` es la fuente de verdad y el README no debe contradecirla.
5. Registra el cambio con `pnpm changeset` (patch, minor o major según [SemVer](https://semver.org/lang/es/)).
6. Usa [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/) (`feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, `chore`...). Un cambio incompatible lleva `!` (`feat!:`) o el footer `BREAKING CHANGE:`.
7. Abre el Pull Request hacia `development` (`development` → `main` también va por PR). CI corre lint, typecheck, tests, build, `publint` y `attw` en Node 22, 24 y 26, y un `npm pack --dry-run`.

## Reglas del repo

- **Sin secretos:** nunca commitees API keys, tokens de servicio, secretos de webhook, URLs internas ni datos reales de WhatsApp. Los tests usan fixtures y `fetch` simulado.
- **Una operación nueva** sigue la forma `(http) => (input, opciones?) => Promise<Resultado<T>>`, valida su entrada con `validarEntrada` y decide explícitamente si se reintenta (los `POST`, `DELETE` y `GET` con efecto, no).
- **Si cambia el contrato de la API**, actualiza los schemas del SDK, su test y [docs/api.md](./docs/api.md).
- **Sin dependencia del auth-sdk:** `./admin` e `./internal` reciben un proveedor de tokens (`obtenerToken`, `invalidarToken?(tokenRechazado)`); el SDK no emite ni renueva tokens. Ante un `401` se reintenta una sola vez: no lo amplíes sin un ADR.

## Entornos y publicación (mantenedores)

Tres entornos, igual que el resto del ecosistema:

| Entorno       | Rama          | Qué publica                                                 | dist-tag |
| ------------- | ------------- | ----------------------------------------------------------- | -------- |
| `local`       | cualquiera    | Nada: el consumidor usa `link`                              | —        |
| `development` | `development` | Snapshot `X.Y.Z-dev-<timestamp>` en cada push con changeset | `dev`    |
| `production`  | `main`        | Versión estable, al publicar una GitHub Release `vX.Y.Z`    | `latest` |

Los releases salen de GitHub Actions (`.github/workflows/release.yml`, un solo archivo porque el trusted publishing de npm está atado a él). Se disparan con `push` (`development`, `main`) y `release`; no hay `workflow_run`. El job `checks` (lint, typecheck, test, build) vive en ese mismo archivo y es `needs` de los dos jobs que publican, así que nada se publica con los checks en rojo y no hay que esperar a otro workflow. Un push a `main` nunca publica.

**Snapshot (`development`).** Tras los `checks`, `changeset version --snapshot dev` calcula la versión desde los changesets pendientes (`snapshot.useCalculatedVersion`). Solo se publica si ese comando cambió el `package.json` (`git diff --quiet`); sin changesets pendientes no se publica nada. `changeset publish --tag dev --no-git-tag` publica con provenance, sin commits ni tags de git. El primer push a `development` puede ser la primera publicación: `release.yml` no necesita existir antes en `main`.

**Estable (GitHub Release).**

1. `pnpm changeset` y commitea el archivo generado junto con el cambio.
2. Merge a `development`: sale el snapshot. Cuando esté probado, PR `development` → `main`.
3. En `main` el job `version-pr` abre (o actualiza) un "Version PR" que sube la versión y el `CHANGELOG.md`; no publica. Revísalo y mergéalo.
4. Crea una GitHub Release `vX.Y.Z` desde `main` (no prerelease; `X.Y.Z` es la versión del `package.json`). No hace falta esperar al CI: el job `publish` corre primero los `checks` sobre el commit del tag y publica solo si pasan.
5. `publish` falla sin publicar si el tag no es `v<versión del package.json>` o si su commit no está en `main`.
6. **Back-merge:** abre un PR `main` → `development` (Version PR y `CHANGELOG.md` incluidos). Sin él, `development` conserva los changesets ya liberados y publica snapshots de una versión que ya salió.
7. Verifica: `npm view @eva_solutions/whatsapp-sdk dist-tags`.

Un push a `main` solo actualiza el Version PR: publicar es una decisión explícita (la Release). El job no crea tags de Changesets; el tag es el de tu Release.

**Casos a conocer.**

- Una prerelease que luego se promueve a release no dispara `published`: crea una Release nueva (no prerelease).
- Una Release de una versión que ya existe en npm termina sin publicar (`changeset publish` omite lo ya publicado) y el job no falla.

### Environment `npm` (publicación protegida)

Los jobs `snapshot` y `publish` declaran `environment: npm`. El Environment limita desde qué refs se puede publicar (segunda capa, además de las condiciones del workflow). Créalo una vez, con permisos de admin del repo `[AUTH]`:

```bash
gh api -X PUT repos/eva-solutions-org/whatsapp-sdk/environments/npm   -F 'deployment_branch_policy[protected_branches]=false'   -F 'deployment_branch_policy[custom_branch_policies]=true'
gh api -X POST repos/eva-solutions-org/whatsapp-sdk/environments/npm/deployment-branch-policies -f name=development -f type=branch
gh api -X POST repos/eva-solutions-org/whatsapp-sdk/environments/npm/deployment-branch-policies -f name='v*' -f type=tag
```

Verifica con `gh api repos/eva-solutions-org/whatsapp-sdk/environments/npm/deployment-branch-policies`. La rama `development` cubre el snapshot y el tag `v*` cubre la Release. Opcional: agrega revisores requeridos en la UI si quieres aprobación manual.

- El trusted publisher de npm se configura con **Environment name = `npm`** (debe coincidir con el del workflow).
- Mientras exista, `NPM_TOKEN` va como **secreto del Environment** (`gh secret set NPM_TOKEN --env npm --repo eva-solutions-org/whatsapp-sdk`, valor en el prompt interactivo), no como secreto del repo.

**Los repos de SDK deben ser PÚBLICOS.** En GitHub Free, las reglas de rama y tag de un Environment (deployment branch policy) y los rulesets solo se aplican en repos públicos; en uno privado no restringen nada.

**Riesgo residual.** Aun con el Environment, quien tenga permiso de escritura puede crear un tag `v*` sobre otro commit y esa ref pasa la política del Environment. El cierre recomendado es un tag ruleset (gratuito en repos públicos) que restrinja la creación de `v*` a admins `[AUTH]`:

```bash
gh api -X POST repos/eva-solutions-org/whatsapp-sdk/rulesets --input - <<'JSON'
{
  "name": "protect-release-tags",
  "target": "tag",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/tags/v*"], "exclude": [] } },
  "rules": [{ "type": "creation" }],
  "bypass_actors": [{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }]
}
JSON
```

`actor_id: 5` es el rol de repositorio Admin. Verifica con `gh api repos/eva-solutions-org/whatsapp-sdk/rulesets` (`target: tag`, `enforcement: active`).

**Primera publicación (bootstrap).** El paquete aún no existe, así que no hay trusted publisher y OIDC no funciona. Sale del job `snapshot` en `development`, con el secreto `NPM_TOKEN` del Environment `npm` (token de npm con permiso de publicar el scope `@eva_solutions`): si el secreto existe, el job lo usa por variable de entorno (`$RUNNER_TEMP/npmrc`, apuntado por `NPM_CONFIG_USERCONFIG`, solo guarda la referencia `${NPM_TOKEN}`, nunca el valor); si no, usa OIDC. El job `publish` de la Release hace lo mismo. Después:

1. En npmjs.com, configura el trusted publisher del paquete: repo `eva-solutions-org/whatsapp-sdk`, workflow `release.yml`, Environment `npm`.
2. Borra el secreto `NPM_TOKEN` y el bloque de bootstrap de `release.yml`.

**`latest` tras el primer snapshot (sin verificar).** No está verificado si el registro asigna `latest` a la primera versión publicada con `--tag dev`. Tras el primer snapshot comprueba `npm view @eva_solutions/whatsapp-sdk dist-tags`. Si `latest` apunta a una versión `-dev-`, el paso `Ensure latest is not a snapshot` intenta quitarlo con `npm dist-tag rm`: usa el token si existe y, si no, OIDC, que solo soporta dist-tag con npm >= 11.21.0 y la opción "Allow npm dist-tag" activada en el trusted publisher. Si falla, deja un warning (no pone el job en rojo, porque ya publicó) y lo quitas a mano con `npm dist-tag rm @eva_solutions/whatsapp-sdk latest`.

### Consumir el SDK según el entorno

```bash
# development: último snapshot
pnpm add @eva_solutions/whatsapp-sdk@dev

# production: estable
pnpm add @eva_solutions/whatsapp-sdk

# local: link al checkout, sin publicar (no commitees file: ni link: en el package.json del consumidor)
pnpm build                  # en este repo
pnpm link ../Whatsapp-sdk   # en el consumidor (ruta relativa a este checkout)
```

## Reportar vulnerabilidades

No abras un issue público. Ver [SECURITY.md](./SECURITY.md).
