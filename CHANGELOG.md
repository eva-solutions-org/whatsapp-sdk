# @eva_solutions/whatsapp-sdk

## 1.0.0

### Major Changes

- 1437b62: **Cambio incompatible.** `./internal` y `./admin` dejan de firmar con HMAC S2S y se autentican con un token Bearer de servicio emitido por Auth (identidad fase 1).

  - `crearClienteInterno` y `crearClienteAdmin` reciben `obtenerToken: () => Promise<string>` e `invalidarToken?: (tokenRechazado: string) => void` en lugar de `clientId` y `secretoHex`, y envían `Authorization: Bearer <token>`. El SDK no depende del auth-sdk: el consumidor pasa su proveedor de tokens.
  - Ante un `401` se invoca `invalidarToken(tokenRechazado)` (puede ser directamente `proveedor.invalidate` del auth-sdk) y la request se reintenta **una sola vez**, también los `POST` (el `401` significa que la API no procesó la request). Sin `invalidarToken` no hay reintento. Un segundo `401` se devuelve como error. Si `obtenerToken` o `invalidarToken` lanzan, el SDK devuelve un `Resultado` de falla (el `500` local expone solo un `code` OAuth no sensible en `detalles`).
  - `./admin` `serviceClients` refleja el registro local de Whatsapp-api sin secreto ni permisos: `ServiceClient` = `{ id, clientId, name, enabled, allowedSourcePhones, createdAt, updatedAt }`, donde `id` es el `sub` del token (uuid de Auth) y `clientId` el slug informativo. Las rutas y los inputs se identifican por `id` (antes `slug`). Se retiran `rotarSecret`, `secret` y `scopes`.
  - Se retiran `crearHttpClientS2S`, `OpcionesClienteS2S`, la firma HMAC y `soportaMultipart`. Nuevos: `crearHttpClientConToken` y `OpcionesClienteConToken` (exportados por `./admin` e `./internal`).
  - Un `403` en `./internal` indica permiso insuficiente en el token, `sub` sin registro habilitado o `sourcePhone` fuera de la allowlist; un `401`, token inválido o vencido.

### Minor Changes

- 215f12c: Modo bot y primitivas de chat en `./internal`.

  - Nuevo `interno.chats` en `crearClienteInterno`: `verificarExistencia({ phone, sourcePhone })` (`GET /v1/internal/chats/{phone}/exists`) e `indicarEscritura({ phone, sourcePhone, estado, segundos? })` (`POST /v1/internal/chats/{phone}/typing`), con validación local estricta, sin reintentar el `POST` y con el `401` reintentado una vez con token nuevo, como el resto de `./internal`.
  - Nuevas opciones de `crearClienteInterno`: `modo: "humano" | "bot"` (default `"humano"`: sin cambios, cero llamadas extra) y `bot` (los mismos ajustes que el cliente público). Con `modo: "bot"`, cada `mensajes.enviar` (texto y media) verifica que el destino tenga WhatsApp (caché por cliente indexada por destino), muestra "escribiendo" un tiempo proporcional al texto y envía. Mismos códigos locales (`numero_sin_whatsapp`, `verificacion_no_disponible`), `siVerificacionFalla`, `alAdvertir` y cancelación que el modo bot público. No marca leído: no hay `messageIds` en la vía interna.
  - `./internal` exporta además `OpcionesClienteInterno`, `OpcionesModoBot` y sus tipos, `CODIGO_NUMERO_SIN_WHATSAPP`, `CODIGO_VERIFICACION_NO_DISPONIBLE` y los tipos de `chats`. Internamente el modo bot pasa a un núcleo compartido por ambas fachadas; el cliente público no cambia.

- e28fc00: Modo bot opcional y primitivas de chat.

  - Nuevo `cliente.chats`: `indicarEscritura`, `verificarExistencia`, `marcarLeido` y `cambiarPresencia` (`/v1/chats/*`, `/v1/presence`).
  - Nuevas opciones de `crearCliente`: `modo: "humano" | "bot"` (default `"humano"`: sin cambios, cero llamadas extra) y `bot` (ajustes). Con `modo: "bot"`, cada envío individual de `mensajes` verifica que el número exista (caché en memoria: 7 días los positivos, 15 min los negativos), marca leído `opciones.messageIds` si se pasan, muestra "escribiendo" un tiempo proporcional al texto (con variación y tope) y envía. Un número sin WhatsApp devuelve `404` local con `codigoApi: "numero_sin_whatsapp"` sin enviar. Si la verificación de un número no cacheado falla (`429`, `503`, red), `bot.siVerificacionFalla` decide: `"no_enviar"` (default) devuelve un error local reintentable `codigoApi: "verificacion_no_disponible"` sin enviar; `"enviar"` avisa por `bot.alAdvertir` y envía (recomendado para clientes de OTP). Marcar leído y escribir son best-effort. La caché es por cliente: un cliente por request la anula. `signal` (global y por operación) corta las esperas del modo bot.
  - `opciones.messageIds` en los envíos de `cliente.mensajes` (solo tiene efecto en modo bot). `enviarLote` no pasa por el modo bot.

- c03ac0f: `ErrorResultado` incluye `origen` (`"api" | "transporte" | "local"`) para distinguir un 503 real de la API de un fallo de red/timeout/cancelación (resultado ambiguo en un POST) y de un rechazo local. Un body `FormData` con el cliente S2S (`./admin`, `./internal`) se rechaza con 400 local en vez de enviar una firma inválida, y el `Content-Type` manual del consumidor se descarta con `FormData`. `./ws` ya no arrastra el cliente REST. `sideEffects: false`.
- c03ac0f: Primera versión del SDK de Whatsapp-api, con 5 subpaths ESM/CJS (Node >= 22):

  - `.`: `crearCliente` (x-api-key) con mensajes (texto, imagen, video, gif, PDF, ubicación y lote), sesión (estado y QR), programados, webhooks fallidos, buffer de eventos WebSocket, billing, seguridad y secreto de webhook.
  - `./webhooks`: verificación de la firma HMAC (`verificarFirmaWebhook`, `verificarWebhookDesdeRequest`) y eventos tipados.
  - `./ws`: `conectarWs`, cliente de eventos en tiempo real (`/v1/ws/events`) con reconexión con backoff, heartbeat y eventos tipados.
  - `./admin`: `crearClienteAdmin` (firma S2S) con service clients y su allowlist de teléfonos, sesiones, QR del sistema, billing, pagos, exención de pago y auditoría.
  - `./internal`: `crearClienteInterno` (firma S2S) para el envío interno de mensajes.

  Núcleo común: Result Pattern (nunca lanza por fallos HTTP), timeout por cliente y por operación (35 s por defecto), reintentos con backoff y `Retry-After` (los POST y los DELETE con efecto no se reintentan; un fallo por timeout o red en un envío es ambiguo), validación de entradas con Zod y respuestas tolerantes a valores nuevos de la API.

### Patch Changes

- a4024ab: Compatibilidad con Cloudflare Workers: usa `redirect: "manual"` y rechaza las respuestas 3xx, porque `redirect: "error"` hace fallar `fetch` en Workers.
