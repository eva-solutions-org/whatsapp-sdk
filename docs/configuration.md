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

Credenciales: `crearCliente` → `apiKey`; `crearClienteAdmin` / `crearClienteInterno` → `clientId` + `secretoHex`. Una opción inválida lanza `ErrorConfiguracion` al construir el cliente.

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

| Variable                                  | Uso                                                |
| ----------------------------------------- | -------------------------------------------------- |
| `EVA_WHATSAPP_BASE_URL`                   | `baseUrl`                                          |
| `EVA_WHATSAPP_API_KEY`                    | `apiKey` (`.` y `./ws`)                            |
| `EVA_S2S_CLIENT_ID`, `EVA_S2S_SECRET_HEX` | `clientId`, `secretoHex` (`./admin`, `./internal`) |
| `WEBHOOK_SECRET`                          | secreto de `./webhooks`                            |

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
| `DELETE`                                                          | no (`reintentar: false` fijo en todas las operaciones) |
| 4xx distintos de 429, errores de parseo, redirects, cancelaciones | no                                                     |

Si la API responde `Retry-After` mayor a `esperaMaximaMs`, no se reintenta y el `429` llega con `retryAfter` (segundos) para que decidas. Los reintentos firman de nuevo (nonce nuevo en S2S).

Override por petición: `reintentar: true | false` en `HttpClient.request/get/post…`. Las operaciones de los facades solo aceptan `signal` y `timeout`; el `HttpClient` lo obtienes con `crearHttpClientS2S` (exportado por `./admin` e `./internal`).

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

`@eva_solutions/auth-sdk` es una devDependency desde `vendor/*.tgz`, usada solo por el test de contrato de la firma S2S (`tests/s2s/`). No es dependencia de runtime. `pnpm-workspace.yaml` aprueba el script de instalación de `esbuild` (`allowBuilds`), necesario con pnpm 11.

Release y CI: ver [CONTRIBUTING.md](../CONTRIBUTING.md#publicación-mantenedores).
