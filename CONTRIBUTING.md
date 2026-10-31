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

1. Crea una rama desde `main`: `git switch -c feat/descripcion-corta`.
2. Sigue las convenciones de [docs/conventions.md](./docs/conventions.md): Result Pattern, validación local, `segmentoRuta`, imports por barrel.
3. Agrega o actualiza tests (`*.mock.test.ts`, sin red) para que la suite pase y el comportamiento nuevo quede cubierto.
4. Actualiza la documentación afectada en el mismo cambio: `docs/` es la fuente de verdad y el README no debe contradecirla.
5. Registra el cambio con `pnpm changeset` (patch, minor o major según [SemVer](https://semver.org/lang/es/)).
6. Usa [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/) (`feat`, `fix`, `docs`, `refactor`, `test`, `build`, `ci`, `chore`...). Un cambio incompatible lleva `!` (`feat!:`) o el footer `BREAKING CHANGE:`.
7. Abre el Pull Request hacia `main`. CI corre lint, typecheck, tests, build, `publint` y `attw` en Node 22, 24 y 26, y un `npm pack --dry-run`.

## Reglas del repo

- **Sin secretos:** nunca commitees API keys, secretos S2S, tokens, URLs internas ni datos reales de WhatsApp. Los tests usan fixtures y `fetch` simulado.
- **Una operación nueva** sigue la forma `(http) => (input, opciones?) => Promise<Resultado<T>>`, valida su entrada con `validarEntrada` y decide explícitamente si se reintenta (los `POST`, `DELETE` y `GET` con efecto, no).
- **Si cambia el contrato de la API**, actualiza los schemas del SDK, su test y [docs/api.md](./docs/api.md).
- **Firma S2S:** `tests/s2s/` compara contra `@eva_solutions/auth-sdk` (devDependency desde `vendor/`). No modifiques la firma sin que ese test lo respalde.

## Publicación (mantenedores)

Los releases salen de GitHub Actions con [Changesets](https://github.com/changesets/changesets) (`.github/workflows/release.yml`): al llegar cambios con changeset a `main`, el workflow abre (o actualiza) un "Version PR"; al mergearlo, publica en npm con provenance y crea el GitHub Release.

1. `pnpm changeset` y commitea el archivo generado junto con el cambio.
2. Merge a `main`: el workflow abre el Version PR.
3. Revisa y mergea el Version PR: publica.
4. Verifica: `npm view @eva_solutions/whatsapp-sdk version`.

`release.yml` se dispara con `workflow_run` solo cuando el CI de un push a `main` termina en éxito: con el CI en rojo no se publica. Cada merge a `main` es un posible release: mergea solo lo que quieras publicar. `release.yml` declara `NPM_TOKEN` solo para la primera publicación (el paquete aún no existe); el workflow indica que se retira después. `CHANGELOG.md` lo genera Changesets en el primer release.

## Reportar vulnerabilidades

No abras un issue público. Ver [SECURITY.md](./SECURITY.md).
