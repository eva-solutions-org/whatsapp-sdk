# Configuración — `@eva_solutions/whatsapp-sdk`

## 1. Como consumidor

### Instalación

```bash
pnpm add @eva_solutions/whatsapp-sdk
```

Requiere Node 22 o superior. El WebSocket usa el `WebSocket` global (Node 22+, Bun, Deno).

### Opciones comunes

`crearCliente`, `crearClienteAdmin` y `crearClienteInterno` comparten estas opciones:

| Opción       | Default            | Descripción                                                                                                                                                                                                  |
| ------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `baseUrl`    | — (obligatoria)    | Origin del servicio                                                                                                                                                                                          |
| `timeout`    | `35_000`           | ms por intento; número > 0                                                                                                                                                                                   |
| `headers`    | —                  | Headers extra; los de autenticación del SDK y los internos ganan ante colisión (las claves se normalizan a minúsculas). Con un body `FormData` se descarta `Content-Type` para que `fetch` ponga el boundary |
| `fetch`      | `globalThis.fetch` | Override para tracing o tests                                                                                                                                                                                |
| `signal`     | —                  | Cancela todas las operaciones en vuelo del cliente                                                                                                                                                           |
| `reintentos` | ver abajo          | `{ maximo, esperaBaseMs, esperaMaximaMs }`                                                                                                                                                                   |

Solo `crearCliente` acepta además `modo` (`"humano"` por defecto, o `"bot"`) y `bot` (ajustes del modo bot, solo válido con `modo: "bot"`): ver [api.md](./api.md#modo-bot). Incluye `bot.siVerificacionFalla` (`"no_enviar"` por defecto, o `"enviar"`: usa este último en un cliente de OTP). La caché de existencia del modo bot vive en el cliente: crea uno por proceso, no uno por request (en Workers anula la caché y gasta el cupo de 120 consultas/hora).

Credenciales: `crearCliente` → `apiKey`; `crearClienteAdmin` / `crearClienteInterno` → `obtenerToken` (requerido) e `invalidarToken(tokenRechazado)` (opcional, sin él no hay reintento ante `401`), un proveedor de tokens de servicio de Auth. Una opción inválida lanza `ErrorConfiguracion` al construir el cliente.

### `baseUrl`

`baseUrl` es el **origin** del servicio y se valida una sola vez, al crear el cliente. Se normaliza a `URL.origin`.

| Se acepta                          | Ejemplo                                                               |
| ---------------------------------- | --------------------------------------------------------------------- |
| `https` con host y puerto opcional | `https://whatsapp.example.com`, `https://whatsapp.example.com:8443`   |
| `http` solo en loopback            | `http://localhost:3000`, `http://127.0.0.1:3000`, `http://[::1]:3000` |

| Se rechaza                               | Ejemplo                                     |
| ---------------------------------------- | ------------------------------------------- |
| Ausente, vacía o no string               | `undefined`, `""`                           |
| URL malformada                           | `not a url`                                 |
| `http` fuera de loopback; otros esquemas | `http://whatsapp.example.com`, `ftp://host` |
| Credenciales                             | `https://usuario:clave@host`                |
| Path distinto de `/`                     | `https://host/v1`                           |
| Query o fragmento (incluso vacíos)       | `https://host?x=1`, `https://host#f`        |

Un path se rechaza en vez de ignorarse porque `new URL(path, base)` descarta en silencio el path de la base. Los mensajes de error nunca repiten el valor recibido.

### Variables de entorno sugeridas

El SDK no lee variables de entorno: eres tú quien pasa los valores. Nombres sugeridos:

| Variable                                   | Uso                                                 |
| ------------------------------------------ | --------------------------------------------------- |
| `EVA_WHATSAPP_BASE_URL`                    | `baseUrl`                                           |
| `EVA_WHATSAPP_API_KEY`                     | `apiKey` (`.` y `./ws`)                             |
| `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET_HEX` | credenciales de tu proveedor de tokens (no del SDK) |
| `WEBHOOK_SECRET`                           | secreto de `./webhooks`                             |

Un entorno, una `baseUrl`: el artefacto es el mismo para todos; cambia el valor, no el paquete.

### Timeouts

- Default **35 s por intento**, porque la API puede tardar hasta 30 s en entregar el QR y hasta 15 s en esperar la sesión en un envío.
- Por cliente: `timeout`. Por operación: segundo argumento `{ timeout }`, que sobreescribe al del cliente.
- Con reintentos, el timeout aplica a cada intento, no al total.
- `signal` (cliente y operación) cancela de inmediato con `503 "Operación cancelada"` (`origen: "transporte"`).

### Reintentos

Política por defecto: `maximo: 2`, `esperaBaseMs: 250`, `esperaMaximaMs: 10_000` (backoff exponencial con jitter del 50 al 100 %). `maximo` acepta enteros de 0 a 10; `0` los desactiva.

| Qué                                                               | Se reintenta                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------ |
| `GET` ante red/timeout, 5xx o 429                                 | sí                                                     |
| `GET` con efecto (QR, `webhookSecret.enviar`)                     | no (`reintentar: false` fijo)                          |
| `POST`, `PUT`, `PATCH`                                            | no: podrían duplicar un mensaje o un cobro             |
| `401` en `./admin` / `./internal` (cualquier método)              | sí, **una vez**, con token nuevo                       |
| `DELETE`                                                          | no (`reintentar: false` fijo en todas las operaciones) |
| 4xx distintos de 429, errores de parseo, redirects, cancelaciones | no                                                     |

Si la API responde `Retry-After` mayor a `esperaMaximaMs`, no se reintenta y el `429` llega con `retryAfter` (segundos) para que decidas. Cada reintento vuelve a pedir el token a `obtenerToken`. Además, `./admin` e `./internal` reintentan **una vez** un `401` (solo si hay `invalidarToken`, que se invoca antes), aun en `POST`; ese reintento no consume `maximo`.

Override por petición: `reintentar: true | false` en `HttpClient.request/get/post…`. Las operaciones de los facades solo aceptan `signal` y `timeout`; el `HttpClient` lo obtienes con `crearHttpClientConToken` (exportado por `./admin` e `./internal`).

## 2. Como contribuidor

Requisitos: Node 22+ y pnpm `11.28.2` (`packageManager`).

```bash
pnpm install --frozen-lockfile
```

| Script                        | Qué hace                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `pnpm build`                  | `tsdown`: `dist/` con ESM + CJS + tipos para los 5 subpaths                                             |
| `pnpm typecheck`              | `tsc --noEmit`                                                                                          |
| `pnpm lint`                   | `oxlint`                                                                                                |
| `pnpm format`                 | `oxfmt`                                                                                                 |
| `pnpm publint`                | `publint` sobre el paquete armado con `pnpm pack` (requiere `pnpm build`)                               |
| `pnpm attw`                   | `attw --pack . --profile node16`: resolución de tipos ESM/CJS de los 5 subpaths (requiere `pnpm build`) |
| `pnpm test` / `pnpm test:run` | Vitest en watch / una sola corrida                                                                      |
| `pnpm changeset`              | Registra un cambio para el próximo release                                                              |

`prepublishOnly` ejecuta lint, typecheck, tests y build. Los tests usan `fetch` y `WebSocket` simulados (`*.mock.test.ts`): no hay red real.

El SDK no depende del auth-sdk, ni en runtime ni en desarrollo: el consumidor pasa su proveedor de tokens. `pnpm-workspace.yaml` aprueba el script de instalación de `esbuild` (`allowBuilds`), necesario con pnpm 11.

Release y CI: ver [CONTRIBUTING.md](../CONTRIBUTING.md#publicación-mantenedores).
