---
"@eva_solutions/whatsapp-sdk": minor
---

Modo bot opcional y primitivas de chat.

- Nuevo `cliente.chats`: `indicarEscritura`, `verificarExistencia`, `marcarLeido` y `cambiarPresencia` (`/v1/chats/*`, `/v1/presence`).
- Nuevas opciones de `crearCliente`: `modo: "humano" | "bot"` (default `"humano"`: sin cambios, cero llamadas extra) y `bot` (ajustes). Con `modo: "bot"`, cada envío individual de `mensajes` verifica que el número exista (caché en memoria: 7 días los positivos, 15 min los negativos), marca leído `opciones.messageIds` si se pasan, muestra "escribiendo" un tiempo proporcional al texto (con variación y tope) y envía. Un número sin WhatsApp devuelve `404` local con `codigoApi: "numero_sin_whatsapp"` sin enviar. Si la verificación de un número no cacheado falla (`429`, `503`, red), `bot.siVerificacionFalla` decide: `"no_enviar"` (default) devuelve un error local reintentable `codigoApi: "verificacion_no_disponible"` sin enviar; `"enviar"` avisa por `bot.alAdvertir` y envía (recomendado para clientes de OTP). Marcar leído y escribir son best-effort. La caché es por cliente: un cliente por request la anula. `signal` (global y por operación) corta las esperas del modo bot.
- `opciones.messageIds` en los envíos de `cliente.mensajes` (solo tiene efecto en modo bot). `enviarLote` no pasa por el modo bot.
