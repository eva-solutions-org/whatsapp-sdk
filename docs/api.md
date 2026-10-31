# Referencia de API — `@eva_solutions/whatsapp-sdk`

Referencia de la superficie pública, por subpath. Los tipos de entrada y respuesta se exportan desde cada subpath; los schemas Zod son internos. Convención de firma: `(input, opciones?)`; sin input: `(opciones?)`. `opciones` es `OpcionesOperacion`: `{ signal?, timeout? }`.

## 1. Cliente `.` (x-api-key)

### `crearCliente(opciones): ClienteWhatsapp`

| Opción       | Obligatoria | Descripción                                                             |
| ------------ | ----------- | ----------------------------------------------------------------------- |
| `apiKey`     | sí          | String no vacío. Se envía como `x-api-key`; nunca aparece en errores    |
| `baseUrl`    | sí          | Origin del servicio. Ver [configuration.md](./configuration.md#baseurl) |
| `timeout`    | no          | ms por intento. Default `35_000`                                        |
| `headers`    | no          | Headers extra; los de autenticación del SDK ganan ante colisión         |
| `fetch`      | no          | Override (tracing, tests). Default `globalThis.fetch`                   |
| `signal`     | no          | `AbortSignal` global: cancela todas las operaciones en vuelo            |
| `reintentos` | no          | `{ maximo?, esperaBaseMs?, esperaMaximaMs? }`                           |

Lanza `ErrorConfiguracion` (síncrono) si `apiKey`, `baseUrl`, `timeout` o `reintentos` son inválidos.

### Namespaces

`cliente.mensajes`, `.sesion`, `.programados`, `.webhooksFallidos`, `.bufferWs`, `.billing`, `.seguridad`, `.webhookSecret`.

#### `cliente.mensajes`

| Método                                                            | Endpoint                          | Entrada                                                   |
| ----------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------- |
| `enviarTexto(input)`                                              | `POST /v1/send/message`           | `{ phone, message }` (mensaje 1 a 100 000 caracteres)     |
| `enviarUbicacion(input)`                                          | `POST /v1/send/location`          | `{ phone, latitude, longitude }`                          |
| `enviarLote(input)`                                               | `POST /v1/send/batch`             | `{ destinatarios[1..500], mensaje }` (mensaje hasta 5000) |
| `enviarImagen(input)` / `enviarVideo(input)` / `enviarGif(input)` | `POST /v1/send/{image,video,gif}` | `{ phone, url \| file, caption? }`                        |
| `enviarPdf(input)`                                                | `POST /v1/send/pdf`               | `{ phone, url \| file, caption?, fileName? }`             |

- `phone`: 7 a 15 dígitos, sin `+`, no empieza en 0.
- Media: `url` y `file` son mutuamente excluyentes (uno solo). `file` es un `Blob` o `{ bytes: Uint8Array, tipoContenido, nombre? }`; `tipoContenido` es obligatorio porque la API valida el MIME.
- La media se envía **siempre como multipart**: la API valida esos endpoints solo como `multipart/form-data` (un JSON se leería como formulario vacío y daría 422).
- Ningún `POST` se reintenta.

#### `cliente.sesion`

| Método                                      | Endpoint                        | Notas                                                                                                         |
| ------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `obtenerQr({ format?: "raw" \| "base64" })` | `GET /v1/session/qr`            | `409` si la sesión ya está conectada; `408` si el QR no llega a tiempo. Sin reintentos: el GET crea la sesión |
| `obtenerQrPng()`                            | `GET /v1/session/qr?format=png` | Retorna `{ bytes, tipoContenido }`. Sin reintentos                                                            |

#### `cliente.programados`

`crear({ destinatario, tipo, payload, programadoPara })` (`programadoPara` ISO 8601 UTC, al menos 1 minuto en el futuro), `listar({ page?, limit? })`, `iterar(filtros?)`, `obtener(id)`, `cancelar(id)`. Rutas `/v1/me/schedule[/:id]`. `limit` máximo 100.

#### `cliente.webhooksFallidos`

`listar({ page?, limit?, estado? })`, `iterar(filtros?)`, `reintentar(id)` (asíncrono: `message` solo lo confirma), `reintentarTodos()`, `descartar(id)`. Rutas `/v1/me/webhooks/failed[...]`.

#### `cliente.bufferWs`

Eventos que la API retiene mientras no hay WebSocket conectado: `listar({ page?, limit? })`, `iterar(filtros?)`, `contar()`, `eliminarTodos()`, `eliminar(id)`. Rutas `/v1/me/ws/pending[...]`.

#### `cliente.billing`

`obtenerBalance()`, `listarMovimientos({ page?, limit?, tipo? })`, `iterarMovimientos(filtros?)`, `crearRecarga({ monto })` (formato `"50.00"`), `obtenerRecarga(id)`, `actualizarConfiguracion({ umbralSaldoBajo })`. Rutas `/v1/me/billing/*`.

#### `cliente.seguridad`

`verificarIp({ code })`: código de 6 dígitos. `POST /v1/security/verify-ip`; `400` si es inválido o expiró.

#### `cliente.webhookSecret`

`enviar()`: la API envía el secreto del webhook por WhatsApp (`GET /v1/me/webhook-secret`). Es un GET con efecto: no se reintenta.

## 2. Iteradores `iterar…`

Async generators sobre los listados. Ceden los items directos y piden las páginas a demanda; un `break` detiene la paginación. Ante el fallo de cualquier página lanzan `Error` con el `Resultado` de falla en `cause`. Cortan en una página vacía o, en listados por cursor, ante un cursor repetido (protección contra una API inconsistente). Propagan `opciones` (`signal`, `timeout`) a cada página.

```typescript
try {
  for await (const evento of cliente.bufferWs.iterar({ limit: 100 })) {
    /* ... */
  }
} catch (err) {
  const fallo = (err as Error).cause; // ErrorResultado: codigo, requestId, detalles...
}
```

Disponibles: `programados.iterar`, `webhooksFallidos.iterar`, `bufferWs.iterar`, `billing.iterarMovimientos`, y en `./admin`: `auditoria.iterarLogs`, `billing.iterarMovimientos`, `exencionPago.iterarHistorial`, `serviceClients.iterar` (los dos últimos por cursor).

## 3. Webhooks (`./webhooks`)

### `verificarWebhookDesdeRequest(request, secreto, opciones?): Promise<Resultado<{ evento }>>`

Verifica la firma y tipa el evento. `opciones`: `{ cuerpoCrudo?: string | Uint8Array, maxBytesCuerpo? }` (default 1 MiB).

| Caso                                                                                             | `codigo`                                     |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Header `X-Webhook-Signature` ausente, secreto vacío o firma inválida                             | `401`                                        |
| Cuerpo mayor a `maxBytesCuerpo`                                                                  | `413`                                        |
| Body ya consumido, no es JSON, o evento **conocido** con forma inválida (la firma sí era válida) | `422`                                        |
| `type` desconocido con firma válida                                                              | **no es error**: `evento.conocido === false` |

Si el framework ya consumió el stream (Hono, Workers), pasa `{ cuerpoCrudo }`: se usa tal cual y no se toca `request.body`.

### `verificarFirmaWebhook({ cuerpoCrudo, firma, secreto }): Promise<Resultado<true>>`

Primitiva de bajo nivel. Todas las fallas son `401`. Firma esperada: `sha256=<hex64 minúsculas>` (HMAC-SHA256 del cuerpo exacto, comparación en tiempo constante). Verifica sobre los bytes crudos, nunca sobre un JSON re-serializado.

### Eventos

`EventoWebhookRecibido = EventoWebhook | EventoDesconocido`. Tipos conocidos: `connection`, `qr`, `message`, `webhook_blocked`, `message_status`. Todos con envelope `{ type, phone, data, timestamp }`. `message` discrimina `data.content` por `data.messageType` (`text`, `image`, `video`, `audio`, `document`, `sticker`, `location`, `contact`, `reaction`). Constantes: `TIPOS_EVENTO_WEBHOOK`, `TIPOS_MENSAJE`, `ESTADOS_MENSAJE`, `HEADER_FIRMA_WEBHOOK`.

## 4. WebSocket (`./ws`)

### `conectarWs(opciones): ClienteWs`

| Opción               | Descripción                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `baseUrl`, `apiKey`  | Obligatorias. La URL resultante es `ws(s)://host/v1/ws/events`; la key viaja en `Sec-WebSocket-Protocol: apikey, <key>` |
| `reconexion`         | `false` la desactiva. O `{ baseMs=1000, maxMs=30000, factor=2, jitter=0.5, maxIntentos=10, estabilidadMs=10000 }`       |
| `maxLongitudMensaje` | Tope en caracteres de un mensaje entrante (default 1 MiB); los mayores se descartan                                     |
| `webSocketImpl`      | Constructor de WebSocket para runtimes sin `WebSocket` global o para tests                                              |

Lanza `ErrorConfiguracion` si `baseUrl`/`apiKey` son inválidos o no hay WebSocket disponible. `ClienteWs`: `on(nombre, escucha)` (retorna la función que cancela), `off`, `desconectar()`, `conectado`.

Eventos: los de notificación por su `type` (`connection`, `qr`, `message`, `webhook_blocked`, `message_status`, `billing_alert`), más `desconocido` (`conocido: false`), `abierto` (`{ conexion }`), `cerrado` (`{ codigo, razon, reconectara }`) y `error` (`{ motivo, mensaje, detalles? }`; motivos `mensaje_invalido`, `mensaje_demasiado_grande`, `conexion`, `reintentos_agotados`).

Comportamiento:

- **Heartbeat:** el cliente responde `pong` a cada `ping` del servidor (cada 30 s; si no responde en 10 s, el servidor cierra).
- **Sin reconexión** tras los cierres `1008`, `4401` y `4403` (`CODIGOS_CIERRE_SIN_RECONEXION`). `4429` y `4503` son transitorios y sí reconectan.
- **Backoff estable:** el contador de fallos se reinicia solo cuando la conexión se considera estable (primer `ping` o `estabilidadMs`), para no entrar en un bucle sin espera si el servidor cierra justo tras aceptar.
- Una `apiKey` inválida se ve como un cierre `1006` sin código (el 401 ocurre en el upgrade); `maxIntentos` evita el bucle eterno.
- Una escucha que lanza no tumba la conexión: su excepción se ignora.
- Al conectar, el servidor entrega los eventos pendientes del buffer (no hay ack).

## 5. Result Pattern y códigos

```typescript
type Resultado<T> = { success: true; data: T } | ErrorResultado;

type ErrorResultado = {
  success: false;
  error: string; // mensaje de la API si existe; nunca credenciales
  codigo: 400 | 401 | 402 | 403 | 404 | 408 | 409 | 413 | 422 | 429 | 500 | 502 | 503;
  origen: "api" | "transporte" | "local"; // quién produjo el error (ver abajo)
  requestId?: string; // header x-request-id, para soporte
  detalles?: unknown; // 422: { formErrors, fieldErrors }
  codigoApi?: string; // error.code de las respuestas S2S
  retryAfter?: number; // solo 429, en segundos
};
```

`origen` distingue la procedencia, que `codigo` por sí solo no revela (un `503` puede ser de la API o de la red; un `422` puede ser local o de la API):

| `origen`       | Significa                         | Ejemplos                                                                                                                                                                         |
| -------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"api"`        | La API respondió                  | Cualquier status HTTP de la API (incluido un `503` real), 2xx con JSON inválido o forma inesperada (`502`), status fuera de la lista (`502`)                                     |
| `"transporte"` | No hubo respuesta                 | Red, DNS, TLS, timeout, cancelación por `signal`, redirect (siempre `503`). En un `POST` el resultado es ambiguo: el mensaje pudo salir                                          |
| `"local"`      | El SDK lo rechazó antes de enviar | Validación `422`, ruta o cuerpo inválidos (`400`), `timeout` inválido (`400`), `FormData` con autenticador S2S (`400`), fallo del autenticador (`500`), verificación de webhooks |

Cuadro de errores generados por el SDK (sin respuesta HTTP o antes de enviar):

| Situación                                                                 | `codigo` | Mensaje                                                                                           |
| ------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| Entrada inválida (validación local con Zod; no se envía ni se firma nada) | `422`    | `Entrada inválida: campo: motivo` (sin los valores recibidos); `detalles` en el formato de la API |
| Ruta o cuerpo no seguro / no serializable (p. ej. `..` en un id)          | `400`    | `Ruta inválida`, `El cuerpo no es serializable a JSON`                                            |
| `timeout` por operación inválido (no es número > 0)                       | `400`    | `timeout debe ser un número > 0 (ms)`                                                             |
| Fallo de red, DNS o TLS                                                   | `503`    | `Error de red al comunicarse con el servicio`                                                     |
| Timeout                                                                   | `503`    | `Tiempo de espera agotado`                                                                        |
| Cancelación por `signal`                                                  | `503`    | `Operación cancelada`                                                                             |
| Redirect                                                                  | `503`    | `Redirect inesperado rechazado por seguridad`                                                     |
| Cuerpo `FormData` con un cliente S2S (`./admin`, `./internal`)            | `400`    | `El autenticador no soporta cuerpos multipart (FormData)`                                         |
| 2xx con JSON inválido o con forma inesperada                              | `502`    | `Respuesta no es JSON válido` / `Shape inesperado: ...`                                           |
| Status HTTP fuera de la lista (418, 504...)                               | `502`    | `Status HTTP inesperado: N`                                                                       |
| El autenticador no pudo firmar (secreto S2S inutilizable)                 | `500`    | `No se pudo autenticar la petición`                                                               |

Helpers: `esExitoso(r)`, `esFallido(r)`. Excepciones al patrón: `ErrorConfiguracion` (único `throw` síncrono), iteradores y cliente WebSocket.

> **`503` en un `POST` de envío es ambiguo:** si `origen` es `"transporte"`, puede ser red o timeout con el mensaje ya enviado. Nunca se reintenta automáticamente. Un `503` con `origen: "api"` es una respuesta real de la API.

## 6. Admin (`./admin`)

### `crearClienteAdmin(opciones): ClienteAdmin`

`opciones` = opciones comunes (`baseUrl`, `timeout`, `headers`, `fetch`, `signal`, `reintentos`) más `clientId` (slug del service client) y `secretoHex` (secreto en hex). El service client necesita el scope `admin`. Lanza `ErrorConfiguracion` si algo es inválido; los mensajes nunca incluyen el secreto.

| Namespace                        | Métodos                                                                                                                                 | Endpoints                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `serviceClients`                 | `crear` (el `secret` viene una única vez), `listar`, `iterar`, `obtener`, `actualizar`, `eliminar`, `rotarSecret`                       | `/v1/admin/service-clients[/:slug][/rotate-secret]`           |
| `serviceClients.telefonosOrigen` | `listar`, `agregar`, `quitar` (allowlist de `sourcePhone` para `./internal`)                                                            | `/v1/admin/service-clients/:slug/...`                         |
| `sesiones`                       | `eliminar({ phone })`                                                                                                                   | `DELETE /v1/admin/sessions/:phone`                            |
| `qrSistema`                      | `obtener`, `obtenerPng`                                                                                                                 | `/v1/admin/system-qr`                                         |
| `billing`                        | `precios.{listar,crear,actualizar,desactivar}`, `ajustarSaldo`, `cambiarMoneda`, `configurar`, `listarMovimientos`, `iterarMovimientos` | `/v1/admin/billing/*`                                         |
| `pagos`                          | `obtener`, `cancelar`, `reembolsar`                                                                                                     | `/v1/admin/billing/pagos/*`                                   |
| `exencionPago`                   | `alternar`, `historial`, `iterarHistorial`                                                                                              | `/v1/admin/billing/users/:userId/payment-exemption[/history]` |
| `auditoria`                      | `listarLogs`, `iterarLogs`, `obtenerUso`                                                                                                | `/v1/admin/audit/*`                                           |

No incluye `/v1/admin/billing/webhook/pagos`. Ningún método con efecto se reintenta.

## 7. Internal (`./internal`)

### `crearClienteInterno(opciones): ClienteInterno`

Mismas opciones que `crearClienteAdmin`. Expone `interno.mensajes.enviar(entrada, opciones?)` → `POST /v1/internal/messages/send`. Entrada, una de dos formas (`strictObject`: mezclar `message` con `mediaUrl` se rechaza con 422 local):

| Forma | Campos                                                                                                            |
| ----- | ----------------------------------------------------------------------------------------------------------------- |
| Texto | `{ phone, message (1..4096), sourcePhone }`                                                                       |
| Media | `{ phone, sourcePhone, mediaUrl, mediaType: "image" \| "video" \| "audio" \| "document", caption? (hasta 1024) }` |

`phone` y `sourcePhone`: 7 a 20 caracteres. `sourcePhone` debe estar en la allowlist del service client y tener sesión vinculada. Errores relevantes:

| `codigo` | Causa                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------- |
| `401`    | Firma, timestamp, replay o client desconocido (`codigoApi` trae el code)                       |
| `403`    | Scope insuficiente para el tipo de mensaje, o `sourcePhone` fuera de la allowlist              |
| `422`    | Body inválido (`detalles`) o `sourcePhone` desconocido                                         |
| `429`    | Rate limit (`retryAfter`)                                                                      |
| `503`    | La sesión del `sourcePhone` no está disponible, o red/timeout (ambiguo: el mensaje pudo salir) |

### Firma S2S

Cada intento se firma con HMAC-SHA-256 sobre un canonical string de 7 líneas: `METHOD`, `PATH`, query canónico (ordenado y recodificado RFC 3986), timestamp (epoch en segundos), nonce (32 hex, nuevo por intento), `clientId` y SHA-256 del body. Headers: `x-eva-client-id`, `x-eva-timestamp`, `x-eva-nonce`, `x-eva-signature` (`sha256=<hex>`). El nonce es de un solo uso en el servidor, por eso los `POST` no se reintentan. Los `GET` con reintento firman de nuevo con nonce nuevo. Un body `FormData` no se puede firmar (sus bytes no se conocen de antemano y se firmaría vacío, lo que la API rechaza con `401`): el autenticador S2S declara `soportaMultipart: false` y el cliente responde `400` con `origen: "local"` sin llamar a la red. La fuente de verdad del algoritmo es `@eva_solutions/auth-sdk`; ver [ADR-002](./decisions.md#adr-002--firma-s2s-propia-con-test-de-contrato-contra-auth-sdk).

## 8. Exports comunes

Todos los subpaths re-exportan `ErrorConfiguracion`, `esExitoso`, `esFallido` y los tipos `Resultado`, `ErrorResultado`, `OrigenError`, `CodigoErrorHttp`. `.`, `./admin` e `./internal` exportan además `OpcionesOperacion`; `./admin` e `./internal` exportan `crearHttpClientS2S`, `HttpClient` y `OpcionesClienteS2S` para casos avanzados (p. ej. `reintentar` por petición).
