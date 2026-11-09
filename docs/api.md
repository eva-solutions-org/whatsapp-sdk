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
| `modo`       | no          | `"humano"` (default) o `"bot"`. Ver [Modo bot](#modo-bot)               |
| `bot`        | no          | Ajustes del modo bot (`OpcionesModoBot`); solo con `modo: "bot"`        |

Lanza `ErrorConfiguracion` (síncrono) si `apiKey`, `baseUrl`, `timeout`, `reintentos`, `modo` o `bot` son inválidos.

### Namespaces

`cliente.mensajes`, `.chats`, `.sesion`, `.programados`, `.webhooksFallidos`, `.bufferWs`, `.billing`, `.seguridad`, `.webhookSecret`.

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

#### `cliente.chats`

Primitivas de chat (`/v1/chats/*`, `/v1/presence`). Todas con `x-api-key`, no cobran y ningún `POST` se reintenta.

| Método                                           | Endpoint                        | Notas                                                                                                 |
| ------------------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `indicarEscritura({ phone, estado, segundos? })` | `POST /v1/chats/{phone}/typing` | `estado`: `escribiendo` \| `grabando` \| `pausa`; `segundos` 1 a 25 (vuelve a pausa solo)             |
| `verificarExistencia({ phone })`                 | `GET /v1/chats/{phone}/exists`  | `{ exists }`. `429` al pasar de 120 consultas/hora por número remitente; la API cachea 6 h por número |
| `marcarLeido({ phone, messageIds })`             | `POST /v1/chats/{phone}/read`   | 1 a 50 ids (`data.messageId` de los eventos `message`); la API responde 200 aunque un id no exista    |
| `cambiarPresencia({ estado })`                   | `POST /v1/presence`             | `en_linea` \| `desconectado`                                                                          |

#### Modo bot

Con `crearCliente({ modo: "bot" })`, cada `enviarTexto`, `enviarImagen`, `enviarVideo`, `enviarGif`, `enviarPdf` y `enviarUbicacion` hace, en orden:

1. **Verificar** que el número tenga WhatsApp (`exists`). Caché en memoria por número y por cliente: un "sí existe" se recuerda `ttlExisteMs` (7 días); un "no existe", `ttlInexistenteMs` (15 min, corto porque el número puede registrarse después). Envíos simultáneos al mismo número comparten una consulta. Si no existe, devuelve `404` con `origen: "local"` y `codigoApi: "numero_sin_whatsapp"` y **no envía**. Si la consulta de un número no cacheado **falla** (`429`, `503` u otro error de red o de la API; no un `exists: false`), manda `bot.siVerificacionFalla`: con `"no_enviar"` (default) devuelve un error con `origen: "local"` y `codigoApi: "verificacion_no_disponible"`, conserva el `codigo` y los datos de la causa (`retryAfter` en un `429`) y **no envía** (no salió nada: reintentar es seguro); con `"enviar"` avisa por `alAdvertir` y envía. Un cliente de OTP, donde entregar el código pesa más que la cautela, debería usar `"enviar"`. Un número ya cacheado como existente no depende de la consulta.
2. **Marcar leído** `opciones.messageIds` (si se pasan: los ids de los mensajes del contacto que respondes).
3. **Escribir**: `indicarEscritura` + espera de `baseMs + msPorCaracter × largo` con variación aleatoria `± variacion` aplicada sobre el valor ya recortado a `topeMs` (cerca del tope también varía) y tope `topeMs`, que nunca se supera. Media con caption usa el largo del caption; media o ubicación sin texto, `mediaMs`. No hay pausas de "distracción".
4. **Enviar**.

Los pasos 2 y 3 son best-effort: si fallan se avisa por `bot.alAdvertir({ paso, error })` y **el envío continúa**. Un fallo de verificación no se cachea. Cancelar (`signal` del cliente o de la operación) corta las esperas y devuelve el error de abort (`503`, `origen: "transporte"`) sin enviar; la consulta de existencia compartida entre envíos simultáneos solo obedece al `signal` del cliente, así que si un llamador aborta los demás reciben igual su resultado.

**La caché es por cliente.** Crear un cliente por request (p. ej. en Cloudflare Workers) la anula: cada envío vuelve a consultar y gasta el cupo de 120 consultas/hora. Crea el cliente una sola vez por proceso o aislado, o pon `verificarExistencia: false`. Con `modo: "humano"` no hay ninguna llamada extra y `messageIds` se ignora. `enviarLote` no pasa por el modo bot. La API ya serializa los envíos por número: el SDK no añade fila propia.

| `bot.…`                   | Default             | Descripción                                                                                    |
| ------------------------- | ------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `verificarExistencia`     | `true`              | `false` omite el paso 1 (p. ej. OTP: ahorra el cupo de 120/hora)                               |
| `siVerificacionFalla`     | `"no_enviar"`       | `"no_enviar"`                                                                                  | `"enviar"`: qué hacer si la consulta de un número no cacheado falla |
| `ttlExisteMs`             | `604_800_000` (7 d) | `0` = no cachear positivos                                                                     |
| `ttlInexistenteMs`        | `900_000` (15 min)  | `0` = no cachear negativos                                                                     |
| `escritura.baseMs`        | `600`               | Tiempo fijo del texto                                                                          |
| `escritura.msPorCaracter` | `40`                | Se suma por carácter del texto                                                                 |
| `escritura.variacion`     | `0.25`              | Fracción 0 a 1, `±` al azar                                                                    |
| `escritura.topeMs`        | `6000`              | Máximo (0 a 25 000), nunca se supera; `0` desactiva el indicador y la espera                   |
| `escritura.mediaMs`       | `1200`              | Media o ubicación sin texto                                                                    |
| `alAdvertir`              | —                   | `({ paso: "verificar" \| "leer" \| "escribir", error }) => void`                               |
| `aleatorio`               | `Math.random`       | `() => [0, 1)`; inyéctalo para tests deterministas (un valor fuera de rango se acota a [0, 1]) |

La validación del teléfono corre antes: un `phone` inválido devuelve el `422` sin llamadas extra. Cualquier otro input inválido se detecta en el envío (después de los pasos previos).

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
  codigoApi?: string; // error.code de las respuestas { error: { code, message } }; "numero_sin_whatsapp" (404 local) o "verificacion_no_disponible" (local, reintentable) del modo bot
  retryAfter?: number; // solo 429, en segundos
};
```

`origen` distingue la procedencia, que `codigo` por sí solo no revela (un `503` puede ser de la API o de la red; un `422` puede ser local o de la API):

| `origen`       | Significa                         | Ejemplos                                                                                                                                                    |
| -------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"api"`        | La API respondió                  | Cualquier status HTTP de la API (incluido un `503` real), 2xx con JSON inválido o forma inesperada (`502`), status fuera de la lista (`502`)                |
| `"transporte"` | No hubo respuesta                 | Red, DNS, TLS, timeout, cancelación por `signal`, redirect (siempre `503`). En un `POST` el resultado es ambiguo: el mensaje pudo salir                     |
| `"local"`      | El SDK lo rechazó antes de enviar | Validación `422`, ruta o cuerpo inválidos (`400`), `timeout` inválido (`400`), fallo del autenticador al obtener el token (`500`), verificación de webhooks |

Cuadro de errores generados por el SDK (sin respuesta HTTP o antes de enviar):

| Situación                                                                | `codigo` | Mensaje                                                                                           |
| ------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------- |
| Entrada inválida (validación local con Zod; no se envía nada)            | `422`    | `Entrada inválida: campo: motivo` (sin los valores recibidos); `detalles` en el formato de la API |
| Ruta o cuerpo no seguro / no serializable (p. ej. `..` en un id)         | `400`    | `Ruta inválida`, `El cuerpo no es serializable a JSON`                                            |
| `timeout` por operación inválido (no es número > 0)                      | `400`    | `timeout debe ser un número > 0 (ms)`                                                             |
| Fallo de red, DNS o TLS                                                  | `503`    | `Error de red al comunicarse con el servicio`                                                     |
| Timeout                                                                  | `503`    | `Tiempo de espera agotado`                                                                        |
| Cancelación por `signal`                                                 | `503`    | `Operación cancelada`                                                                             |
| Redirect                                                                 | `503`    | `Redirect inesperado rechazado por seguridad`                                                     |
| 2xx con JSON inválido o con forma inesperada                             | `502`    | `Respuesta no es JSON válido` / `Shape inesperado: ...`                                           |
| Status HTTP fuera de la lista (418, 504...)                              | `502`    | `Status HTTP inesperado: N`                                                                       |
| `obtenerToken` falló o devolvió un token vacío (`./admin`, `./internal`) | `500`    | `No se pudo autenticar la petición`                                                               |

Helpers: `esExitoso(r)`, `esFallido(r)`. Excepciones al patrón: `ErrorConfiguracion` (único `throw` síncrono), iteradores y cliente WebSocket.

> **`503` en un `POST` de envío es ambiguo:** si `origen` es `"transporte"`, puede ser red o timeout con el mensaje ya enviado. Nunca se reintenta automáticamente. Un `503` con `origen: "api"` es una respuesta real de la API.

## 6. Admin (`./admin`)

### `crearClienteAdmin(opciones): ClienteAdmin`

`opciones` = opciones comunes (`baseUrl`, `timeout`, `headers`, `fetch`, `signal`, `reintentos`) más `obtenerToken: () => Promise<string>` (requerido) e `invalidarToken?: (tokenRechazado: string) => void` (puede ser directamente `proveedor.invalidate` del auth-sdk). Envían `Authorization: Bearer <token>`; el token es un token de servicio de Auth con `aud: whatsapp-api` y el permiso `admin`. Ante un `401` se invoca `invalidarToken(tokenRechazado)` y la request se reintenta una vez; sin `invalidarToken` no se reintenta (ver [§7](#7-internal-internal)). Lanza `ErrorConfiguracion` si `obtenerToken`, `invalidarToken` o las opciones comunes son inválidos; los mensajes nunca incluyen el token.

| Namespace                        | Métodos                                                                                                                                 | Endpoints                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `serviceClients`                 | `crear`, `listar`, `iterar`, `obtener`, `actualizar`, `eliminar` (registro local, sin secreto ni permisos; ver abajo)                   | `/v1/admin/service-clients[/:id]`                             |
| `serviceClients.telefonosOrigen` | `listar`, `agregar`, `quitar` (allowlist de `sourcePhone` para `./internal`)                                                            | `/v1/admin/service-clients/:id/source-phones[/:phone]`        |
| `sesiones`                       | `eliminar({ phone })`                                                                                                                   | `DELETE /v1/admin/sessions/:phone`                            |
| `qrSistema`                      | `obtener`, `obtenerPng`                                                                                                                 | `/v1/admin/system-qr`                                         |
| `billing`                        | `precios.{listar,crear,actualizar,desactivar}`, `ajustarSaldo`, `cambiarMoneda`, `configurar`, `listarMovimientos`, `iterarMovimientos` | `/v1/admin/billing/*`                                         |
| `pagos`                          | `obtener`, `cancelar`, `reembolsar`                                                                                                     | `/v1/admin/billing/pagos/*`                                   |
| `exencionPago`                   | `alternar`, `historial`, `iterarHistorial`                                                                                              | `/v1/admin/billing/users/:userId/payment-exemption[/history]` |
| `auditoria`                      | `listarLogs`, `iterarLogs`, `obtenerUso`                                                                                                | `/v1/admin/audit/*`                                           |

No incluye `/v1/admin/billing/webhook/pagos`. Ningún método con efecto se reintenta, salvo el único reintento ante `401` descrito arriba.

#### `serviceClients`: registro local de Whatsapp-api

Las credenciales y los permisos de un service client viven en Auth; Whatsapp-api solo guarda un registro local. `ServiceClient` = `{ id, clientId, name, enabled, allowedSourcePhones, createdAt, updatedAt }`:

- `id`: id interno del service client en Auth (uuid). Es el `sub` del token y la clave de todas las rutas. Nunca cambia.
- `clientId`: slug de Auth (`client_id` del token). Solo informativo (logs, UI); no identifica.
- `crear({ id, clientId, name, enabled?, allowedSourcePhones? })` → `POST`. `409` si el `id` ya está registrado. Un `sub` sin registro habilitado recibe `403` en `./internal`.
- `actualizar({ id, clientId?, name?, enabled? })` → `PATCH` parcial. `eliminar({ id })` borra el registro local, no el service client de Auth.
- `telefonosOrigen.{listar,agregar,quitar}({ id, phone? })` administran `allowedSourcePhones` (`{ id, allowedSourcePhones }`).
- Ya no existen `rotarSecret`, `secret` ni `scopes`: el secreto lo rota Auth y los permisos viajan en el token.

## 7. Internal (`./internal`)

### `crearClienteInterno(opciones): ClienteInterno`

Mismas opciones que `crearClienteAdmin` (`obtenerToken`, `invalidarToken?`; el token lleva `aud: whatsapp-api` y el permiso del tipo de mensaje). Expone `interno.mensajes.enviar(entrada, opciones?)` → `POST /v1/internal/messages/send`. Entrada, una de dos formas (`strictObject`: mezclar `message` con `mediaUrl` se rechaza con 422 local):

| Forma | Campos                                                                                                            |
| ----- | ----------------------------------------------------------------------------------------------------------------- |
| Texto | `{ phone, message (1..4096), sourcePhone }`                                                                       |
| Media | `{ phone, sourcePhone, mediaUrl, mediaType: "image" \| "video" \| "audio" \| "document", caption? (hasta 1024) }` |

`phone` y `sourcePhone`: 7 a 20 caracteres. `sourcePhone` debe estar en la allowlist del service client y tener sesión vinculada. Un `401` invalida el token (`invalidarToken`) y reintenta **una vez** con uno nuevo, también este `POST` (el `401` significa que la API no procesó el envío); si el segundo intento también devuelve `401`, ese es el resultado. Errores relevantes:

| `codigo` | Causa                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| `401`    | Token inválido, vencido o de otra audiencia, tras el reintento con token nuevo (`codigoApi`)                  |
| `403`    | Token sin el permiso del tipo de mensaje, `sub` sin registro habilitado o `sourcePhone` fuera de la allowlist |
| `422`    | Body inválido (`detalles`) o `sourcePhone` desconocido                                                        |
| `429`    | Rate limit (`retryAfter`)                                                                                     |
| `503`    | La sesión del `sourcePhone` no está disponible, o red/timeout (ambiguo: el mensaje pudo salir)                |

### Autenticación con token de servicio

`./admin` e `./internal` envían `Authorization: Bearer <token>`. El SDK no emite ni renueva tokens y no depende del auth-sdk: `obtenerToken` (tu proveedor, que cachea y renueva) se invoca en cada intento de request. Si lanza o devuelve algo que no es un string no vacío, la request no se envía y el resultado es `500` con `origen: "local"` (sin el motivo, que podría contener datos sensibles). Única excepción: si el error trae un `code` con forma de código OAuth (minúsculas y `_`, p. ej. `invalid_client`, `temporarily_unavailable`), se expone en `detalles: { code }` para diagnosticar; códigos de red (`ECONNREFUSED`) o cualquier otro valor se descartan. Si `obtenerToken` lanza, nunca escapa una excepción.

Ante un `401`, el http client invoca `invalidarToken(tokenRechazado)` y reintenta **una sola vez**, en cualquier método. El token rechazado permite al proveedor invalidar solo si sigue siendo ese (evita la estampida de tokens con requests concurrentes). **Sin `invalidarToken` no hay reintento**: saldría con el mismo token cacheado y el `401` se devuelve. Si `invalidarToken` lanza, se devuelve el `401` sin reintentar; si `obtenerToken` lanza en el reintento, el resultado es el `500` local. En ambos casos el error se devuelve como `Resultado`, no se lanza. Se reintenta en cualquier método: el `401` significa que la API no procesó la request, así que reintentar un `POST` no duplica nada. El reintento no consume el presupuesto de `reintentos`. Un segundo `401` se devuelve tal cual. Ver [ADR-009](./decisions.md#adr-009--bearer-de-servicio-con-proveedor-de-tokens-inyectado). Como Bearer no firma el body, un `FormData` es válido con estos clientes.

## 8. Exports comunes

Todos los subpaths re-exportan `ErrorConfiguracion`, `esExitoso`, `esFallido` y los tipos `Resultado`, `ErrorResultado`, `OrigenError`, `CodigoErrorHttp`. `.`, `./admin` e `./internal` exportan además `OpcionesOperacion`; `./admin` e `./internal` exportan `crearHttpClientConToken`, `HttpClient` y `OpcionesClienteConToken` para casos avanzados (p. ej. `reintentar` por petición).
