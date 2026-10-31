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

- c03ac0f: `ErrorResultado` incluye `origen` (`"api" | "transporte" | "local"`) para distinguir un 503 real de la API de un fallo de red/timeout/cancelación (resultado ambiguo en un POST) y de un rechazo local. Un body `FormData` con el cliente S2S (`./admin`, `./internal`) se rechaza con 400 local en vez de enviar una firma inválida, y el `Content-Type` manual del consumidor se descarta con `FormData`. `./ws` ya no arrastra el cliente REST. `sideEffects: false`.
- c03ac0f: Primera versión del SDK de Whatsapp-api, con 5 subpaths ESM/CJS (Node >= 22):

  - `.`: `crearCliente` (x-api-key) con mensajes (texto, imagen, video, gif, PDF, ubicación y lote), sesión (estado y QR), programados, webhooks fallidos, buffer de eventos WebSocket, billing, seguridad y secreto de webhook.
  - `./webhooks`: verificación de la firma HMAC (`verificarFirmaWebhook`, `verificarWebhookDesdeRequest`) y eventos tipados.
  - `./ws`: `conectarWs`, cliente de eventos en tiempo real (`/v1/ws/events`) con reconexión con backoff, heartbeat y eventos tipados.
  - `./admin`: `crearClienteAdmin` (firma S2S) con service clients y su allowlist de teléfonos, sesiones, QR del sistema, billing, pagos, exención de pago y auditoría.
  - `./internal`: `crearClienteInterno` (firma S2S) para el envío interno de mensajes.

  Núcleo común: Result Pattern (nunca lanza por fallos HTTP), timeout por cliente y por operación (35 s por defecto), reintentos con backoff y `Retry-After` (los POST y los DELETE con efecto no se reintentan; un fallo por timeout o red en un envío es ambiguo), validación de entradas con Zod y respuestas tolerantes a valores nuevos de la API.
