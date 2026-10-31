# @eva_solutions/whatsapp-sdk

SDK TypeScript para consumir el servicio Whatsapp-api. Simple por defecto, con control avanzado opcional.

```
✓ Runtime         Node 22+ (ESM y CJS)
✓ Seguridad       apiKey, tokens y secretos solo en el servidor
✓ Errores         Result Pattern: nunca lanza por un fallo HTTP o de validación
✓ Config          baseUrl en runtime: un solo paquete para todos los entornos
✓ Superficies     5 subpaths: x-api-key, webhooks, WebSocket, admin (Bearer), internal (Bearer)
✓ Dependencias    zod, nada más
```

**No browser:** la `apiKey`, los tokens de servicio y el secreto del webhook son secretos y deben quedarse en tu servidor.

**Licencia:** MIT. **Versiones y cambios:** `CHANGELOG.md` lo genera Changesets al publicar cada release.

## Subpaths

| Subpath                                | Qué expone                                                                                                          | Autenticación                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `@eva_solutions/whatsapp-sdk`          | `crearCliente`: mensajes, sesión, programados, webhooks fallidos, buffer WS, billing, seguridad, secreto de webhook | `x-api-key`                               |
| `@eva_solutions/whatsapp-sdk/webhooks` | Verificación de la firma HMAC de los webhooks y eventos tipados                                                     | secreto del webhook                       |
| `@eva_solutions/whatsapp-sdk/ws`       | `conectarWs`: eventos en tiempo real con reconexión                                                                 | `x-api-key` (en `Sec-WebSocket-Protocol`) |
| `@eva_solutions/whatsapp-sdk/admin`    | `crearClienteAdmin`: service clients, sesiones, QR del sistema, billing, pagos, exención, auditoría                 | token Bearer de servicio (Auth)           |
| `@eva_solutions/whatsapp-sdk/internal` | `crearClienteInterno`: envío interno de mensajes                                                                    | token Bearer de servicio (Auth)           |

Cada subpath existe en ESM y CJS. Quien no usa un subpath no lo carga.

## Instalación

```bash
pnpm add @eva_solutions/whatsapp-sdk
# o: npm install @eva_solutions/whatsapp-sdk
```

> Requiere Node 22 o superior (`engines.node`).

## Quickstart

### `.` — API pública con `x-api-key`

```typescript
import { crearCliente } from "@eva_solutions/whatsapp-sdk";

const cliente = crearCliente({
  apiKey: process.env.EVA_WHATSAPP_API_KEY!,
  baseUrl: process.env.EVA_WHATSAPP_BASE_URL!, // origin, ej. https://whatsapp.example.com
});

const r = await cliente.mensajes.enviarTexto({ phone: "59171234567", message: "Hola" });

if (!r.success) {
  console.error(`Error ${r.codigo}: ${r.error}`);
  return;
}
console.log(r.data.message);
```

`apiKey` y `baseUrl` son obligatorios. Si falta alguno o no es válido, `crearCliente` lanza `ErrorConfiguracion` de forma síncrona (los mensajes nunca incluyen sus valores).

### `./webhooks` — verificar la firma

```typescript
import { verificarWebhookDesdeRequest } from "@eva_solutions/whatsapp-sdk/webhooks";

export async function POST(request: Request) {
  const r = await verificarWebhookDesdeRequest(request, process.env.WEBHOOK_SECRET!);
  if (!r.success) {
    return new Response(r.error, { status: r.codigo }); // 401, 413 o 422
  }

  const evento = r.data.evento;
  if (evento.conocido === false) {
    return new Response("ok"); // tipo nuevo de la API: ignóralo o regístralo
  }
  if (evento.type === "message") {
    console.log(evento.data.from, evento.data.messageType);
  }
  return new Response("ok");
}
```

Si tu framework ya leyó el body (Hono, Workers), pásalo con `{ cuerpoCrudo }` como tercer argumento. Ver [docs/api.md](./docs/api.md#3-webhooks-webhooks).

### `./ws` — eventos en tiempo real

```typescript
import { conectarWs } from "@eva_solutions/whatsapp-sdk/ws";

const ws = conectarWs({
  baseUrl: process.env.EVA_WHATSAPP_BASE_URL!,
  apiKey: process.env.EVA_WHATSAPP_API_KEY!,
  // webSocketImpl: WebSocket de la librería 'ws', solo si tu runtime no tiene WebSocket global
});

ws.on("message", (evento) => console.log(evento.data.messageType));
ws.on("desconocido", (evento) => console.log("tipo nuevo:", evento.type));
ws.on("cerrado", ({ codigo, reconectara }) => console.log(codigo, reconectara));
ws.on("error", (e) => console.error(e.motivo, e.mensaje));

// al apagar el proceso:
ws.desconectar();
```

Usa el `WebSocket` global (Node 22+, Bun, Deno). Para otro runtime, o en tests, inyecta `webSocketImpl`.

### `./admin` — administración (token de servicio)

```typescript
import { crearClienteAdmin } from "@eva_solutions/whatsapp-sdk/admin";

const admin = crearClienteAdmin({
  baseUrl: process.env.EVA_WHATSAPP_BASE_URL!,
  obtenerToken: () => proveedor.getToken(), // token de servicio emitido por Auth
  invalidarToken: proveedor.invalidate, // opcional: recibe el token rechazado
});

const r = await admin.serviceClients.listar();
```

El SDK **no** obtiene ni renueva tokens y no depende del auth-sdk: tú pasas un proveedor (por ejemplo `createServiceTokenProvider` del auth-sdk, con `audience: "whatsapp-api"`) que cachea y renueva. `obtenerToken` se invoca en cada intento de request. El token necesita `aud: whatsapp-api` y el permiso `admin`.

`invalidarToken(tokenRechazado)` recibe el token que provocó el `401`; el `invalidate` del auth-sdk lo acepta directamente y solo descarta el caché si sigue siendo ese token (varias requests concurrentes con un `401` no provocan una estampida de tokens nuevos). Ante un `401` el SDK llama a `invalidarToken` y reintenta **una sola vez** con un token nuevo, también los `POST` (un `401` significa que la API no procesó la request). Un segundo `401` se devuelve como error. **Sin `invalidarToken` no hay reintento ante `401`**: saldría con el mismo token cacheado. Si `obtenerToken` o `invalidarToken` lanzan, el SDK no propaga la excepción: devuelve un `Resultado` de falla.

### `./internal` — envío interno (token de servicio)

```typescript
import { crearClienteInterno } from "@eva_solutions/whatsapp-sdk/internal";

const interno = crearClienteInterno({
  baseUrl: process.env.EVA_WHATSAPP_BASE_URL!,
  obtenerToken: () => proveedor.getToken(),
  invalidarToken: proveedor.invalidate,
});

const r = await interno.mensajes.enviar({
  phone: "59171234567",
  message: "Hola",
  sourcePhone: "59170000000", // debe estar en la allowlist del service client
});
```

El token necesita `aud: whatsapp-api` y el permiso del tipo de mensaje (`messages:send:text` o `messages:send:media`). Su `sub` debe tener un registro habilitado en Whatsapp-api (`admin.serviceClients.crear`), si no la API responde `403`.

## Result Pattern y códigos

Toda operación retorna `Promise<Resultado<T>>` y no lanza por fallos de negocio:

```typescript
type Resultado<T> = { success: true; data: T } | ErrorResultado;
// ErrorResultado: { success: false; error: string; codigo: CodigoErrorHttp;
//   requestId?: string; detalles?: unknown; codigoApi?: string; retryAfter?: number /* solo 429 */ }
```

| `codigo`                      | Significa                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `400`                         | La API rechazó la petición; o el SDK rechazó la ruta o el cuerpo antes de enviarlo                                              |
| `401` / `403`                 | Token inválido o vencido (`401`) / sin permiso o sin registro habilitado (`403`); `codigoApi` trae el code cuando existe        |
| `402`                         | Pago requerido                                                                                                                  |
| `404` / `408` / `409` / `413` | El de la API (`408`: el QR no llegó a tiempo; `409`: sesión ya conectada)                                                       |
| `422`                         | Validación. **Local** (el SDK validó tu entrada y no envió nada) o **de la API**. `detalles` trae `{ formErrors, fieldErrors }` |
| `429`                         | Rate limit. `retryAfter` en segundos                                                                                            |
| `500` / `502`                 | Error del servicio; `502` también si la respuesta no tiene la forma esperada                                                    |
| `503`                         | Servicio no disponible **o fallo de red, timeout o cancelación sin respuesta** (mira `origen`)                                  |

> **`503` es ambiguo en un envío.** Si un `POST` de envío termina en `503` por red o timeout, el mensaje pudo haber salido. El SDK no reintenta los `POST` justamente para no duplicarlo: consulta antes de reenviar o acepta el riesgo de duplicado.

`origen` distingue quién produjo el error: `"api"` (la API respondió, incluido un `503` real), `"transporte"` (no hubo respuesta: red, DNS, TLS, timeout, cancelación o redirect; en un `POST` es el caso ambiguo) y `"local"` (el SDK lo rechazó antes de enviar: validación `422`, ruta o cuerpo inválidos, o fallo al obtener el token). Para decidir si reenviar, mira `origen === "transporte"`, no solo `codigo === 503`.

Helpers: `esExitoso(r)` y `esFallido(r)`. Excepciones al patrón: `ErrorConfiguracion` al construir un cliente, los iteradores `iterar…` y el cliente WebSocket (que reporta por eventos). Detalle en [docs/api.md](./docs/api.md#5-result-pattern-y-códigos).

## Timeouts

- Default: **35 s por intento** (cubre la espera del QR de la API, hasta 30 s).
- Por cliente: `crearCliente({ timeout })`. Por operación: `cliente.sesion.obtenerQr(input, { timeout })`.
- Cancelación: `signal` del cliente y `signal` por operación, combinadas con el timeout. Un abort del consumidor responde `503 "Operación cancelada"`; un timeout, `503 "Tiempo de espera agotado"`.

## Reintentos

Solo se reintentan las lecturas (`GET`) sin efecto, ante error de red/timeout, 5xx y 429, con backoff exponencial y respetando `Retry-After` (default: 2 reintentos, base 250 ms, tope 10 s).

- Nunca se reintentan `POST`, `PUT` ni `PATCH`, ni los `DELETE`, ni los `GET` con efecto (QR, secreto de webhook). Única excepción: en `./admin` e `./internal`, un `401` se reintenta **una vez** con un token nuevo, en cualquier método (la API no procesó la request).
- Si la API pide esperar más que `esperaMaximaMs`, no se reintenta y el `429` llega con `retryAfter`.
- Ajuste global: `reintentos: { maximo, esperaBaseMs, esperaMaximaMs }` (`maximo: 0` los desactiva).
- El override por petición `reintentar: true | false` existe en el cliente HTTP de bajo nivel (`crearHttpClientConToken` de `./admin` e `./internal`), no en las opciones de las operaciones (`signal` y `timeout`). Ver [docs/configuration.md](./docs/configuration.md#reintentos).

## Paginación

Cada listado paginado tiene un `listar` manual y un `iterar…` que pide las páginas a demanda:

```typescript
try {
  for await (const programado of cliente.programados.iterar({ limit: 50 })) {
    console.log(programado.id);
  }
} catch (err) {
  const fallo = (err as Error).cause as { codigo: number } | undefined; // el Resultado de falla
}
```

Los iteradores son la excepción al Result Pattern: ceden los items directos y, ante un fallo, lanzan `Error` con el `Resultado` en `cause`.

## Eventos desconocidos (forward-compat)

La API puede agregar tipos de evento sin que sea un error. Un evento con `type` nuevo, o un `message` con `messageType` nuevo, llega con `conocido: false` (`EventoDesconocido`); en el WebSocket se emite como evento `desconocido`. Los valores nuevos en enums de respuesta también se toleran. Un evento de tipo **conocido** con forma inválida sí es un fallo (`422`).

## Seguridad

- **Servidor únicamente:** `apiKey`, los tokens de servicio y el secreto del webhook nunca van al navegador ni a logs.
- **Webhooks:** la firma no incluye timestamp, así que un evento reenviado sigue siendo válido. Deduplica en tu handler (por ejemplo con `data.messageId` cuando el evento lo trae, o con `type` + `phone` + `timestamp`).
- **Redirects:** el SDK los rechaza (`redirect: "error"`) para no filtrar credenciales a otro host.
- **`baseUrl`:** solo origin (`https` o `http` en loopback), sin credenciales, path, query ni fragmento.

Modelo de amenazas completo en [docs/security.md](./docs/security.md).

## Qué NO cubre el SDK

| Ruta de la API                                                | Por qué                                                                |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `/v1/me/api-keys`, `/v1/me/usuario`                           | Se autentican con la cookie de sesión del panel, no con `x-api-key`    |
| Webhook entrante de pagos (`/v1/admin/billing/webhook/pagos`) | Lo llama el procesador de pagos, no es una operación de administración |
| Obtención y renovación de tokens de servicio                  | Es del proveedor que pasas en `obtenerToken` (auth-sdk), no del SDK    |

## Desarrollo (contribuidores)

Requisitos: Node 22+ y pnpm `11.28.2` (declarado en `packageManager`).

```bash
pnpm install --frozen-lockfile
pnpm build         # tsdown: dist/ con ESM + CJS para los 5 subpaths
pnpm typecheck
pnpm lint          # oxlint
pnpm test:run
pnpm format        # oxfmt
pnpm changeset     # registra un cambio para el próximo release
```

Guía completa en [CONTRIBUTING.md](./CONTRIBUTING.md).

## Documentación

| Documento                                        | Contenido                                           |
| ------------------------------------------------ | --------------------------------------------------- |
| [docs/api.md](./docs/api.md)                     | Referencia de la API pública por subpath            |
| [docs/architecture.md](./docs/architecture.md)   | Capas, flujo HTTP, tokens de servicio, WebSocket    |
| [docs/configuration.md](./docs/configuration.md) | Opciones, `baseUrl`, timeouts, reintentos, runtimes |
| [docs/conventions.md](./docs/conventions.md)     | Naming, Result Pattern, imports, tests              |
| [docs/decisions.md](./docs/decisions.md)         | ADRs                                                |
| [docs/security.md](./docs/security.md)           | Modelo de amenazas y recomendaciones                |
| [SECURITY.md](./SECURITY.md)                     | Cómo reportar una vulnerabilidad                    |

## Licencia

MIT © EVA Solutions. Ver [`LICENSE`](./LICENSE).
