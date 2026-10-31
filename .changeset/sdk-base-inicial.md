---
"@eva_solutions/whatsapp-sdk": minor
---

Primera versión del SDK de Whatsapp-api, con 5 subpaths ESM/CJS (Node >= 22):

- `.`: `crearCliente` (x-api-key) con mensajes (texto, imagen, video, gif, PDF, ubicación y lote), sesión (estado y QR), programados, webhooks fallidos, buffer de eventos WebSocket, billing, seguridad y secreto de webhook.
- `./webhooks`: verificación de la firma HMAC (`verificarFirmaWebhook`, `verificarWebhookDesdeRequest`) y eventos tipados.
- `./ws`: `conectarWs`, cliente de eventos en tiempo real (`/v1/ws/events`) con reconexión con backoff, heartbeat y eventos tipados.
- `./admin`: `crearClienteAdmin` (firma S2S) con service clients y su allowlist de teléfonos, sesiones, QR del sistema, billing, pagos, exención de pago y auditoría.
- `./internal`: `crearClienteInterno` (firma S2S) para el envío interno de mensajes.

Núcleo común: Result Pattern (nunca lanza por fallos HTTP), timeout por cliente y por operación (35 s por defecto), reintentos con backoff y `Retry-After` (los POST y los DELETE con efecto no se reintentan; un fallo por timeout o red en un envío es ambiguo), validación de entradas con Zod y respuestas tolerantes a valores nuevos de la API.
