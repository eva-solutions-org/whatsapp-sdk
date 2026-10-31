# Whatsapp-sdk

`@eva_solutions/whatsapp-sdk`: cliente TypeScript del servicio Whatsapp-api (`D:/GitHub/Proyecto Global/Whatsapp Service/Whatsapp-api`). Paquete único, cinco subpaths, Result Pattern, única dependencia de runtime: `zod`.

## Cómo trabajamos

Scripts (`pnpm run <script>`):

| Script              | Uso                                                                 |
| ------------------- | ------------------------------------------------------------------- |
| `build`             | tsdown: ESM + CJS + tipos de los 5 subpaths en `dist/`              |
| `typecheck`         | `tsc --noEmit`                                                      |
| `lint` / `format`   | oxlint / oxfmt                                                      |
| `publint` / `attw`  | Revisan el paquete armado (requieren `build`); también corren en CI |
| `test` / `test:run` | Vitest en watch / una corrida                                       |
| `changeset`         | Registra un cambio para el próximo release                          |

- **Ramas:** `main` publica: `.github/workflows/release.yml` corre `changesets/action` cuando el CI de un push a `main` termina en éxito. Detalle en [`CONTRIBUTING.md`](CONTRIBUTING.md#publicación-mantenedores).
- **Commits:** conventional commits; `feat!` o `BREAKING CHANGE:` para cambios incompatibles. Sin atribución de IA ni co-autores.
- **Docs:** `docs/` es la fuente de verdad. Este archivo solo indexa: las reglas viven en `docs/`. Actualiza el documento afectado en el mismo cambio.
- **Repo público:** nunca commitees secretos, tokens, URLs internas ni topología privada.
- **Idioma:** identificadores, comentarios y documentación en español (como la API y el SDK de Pagos).

## Directorio

### Mapa de código (`src/`, una entrada por subpath)

| Subpath      | Ruta              | Propósito                                      |
| ------------ | ----------------- | ---------------------------------------------- |
| `.`          | `src/index.ts`    | `crearCliente` (x-api-key) y tipos compartidos |
| `./webhooks` | `src/webhooks.ts` | Verificación de firma HMAC y eventos           |
| `./ws`       | `src/ws.ts`       | Cliente WebSocket de eventos en tiempo real    |
| `./admin`    | `src/admin.ts`    | Cliente de administración (firma S2S)          |
| `./internal` | `src/internal.ts` | Envío interno de mensajes (firma S2S)          |

Otros: `src/core/` (cliente, http-client, s2s, validación, paginación, errores, tipos), `src/features/<nombre>/{domain,application}` (un feature por área), `tests/` (Vitest `*.mock.test.ts`, `tests/s2s/` es el test de contrato contra `@eva_solutions/auth-sdk`), `vendor/` (tarball de `@eva_solutions/auth-sdk`, solo devDependency), `.changeset/` (cambios pendientes).

### Índice de `docs/`

| Doc                                       | Contenido                                                  |
| ----------------------------------------- | ---------------------------------------------------------- |
| [api.md](docs/api.md)                     | Referencia de la API pública por subpath, códigos de error |
| [architecture.md](docs/architecture.md)   | Capas, flujo HTTP, S2S, WebSocket                          |
| [configuration.md](docs/configuration.md) | Opciones, `baseUrl`, timeouts, reintentos, scripts         |
| [conventions.md](docs/conventions.md)     | Naming, Result Pattern, validación, imports, tests         |
| [decisions.md](docs/decisions.md)         | ADRs                                                       |
| [security.md](docs/security.md)           | Modelo de amenazas y recomendaciones                       |

Raíz: `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`.
