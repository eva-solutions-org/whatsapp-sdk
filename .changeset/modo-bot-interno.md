---
"@eva_solutions/whatsapp-sdk": minor
---

Modo bot y primitivas de chat en `./internal`.

- Nuevo `interno.chats` en `crearClienteInterno`: `verificarExistencia({ phone, sourcePhone })` (`GET /v1/internal/chats/{phone}/exists`) e `indicarEscritura({ phone, sourcePhone, estado, segundos? })` (`POST /v1/internal/chats/{phone}/typing`), con validación local estricta, sin reintentar el `POST` y con el `401` reintentado una vez con token nuevo, como el resto de `./internal`.
- Nuevas opciones de `crearClienteInterno`: `modo: "humano" | "bot"` (default `"humano"`: sin cambios, cero llamadas extra) y `bot` (los mismos ajustes que el cliente público). Con `modo: "bot"`, cada `mensajes.enviar` (texto y media) verifica que el destino tenga WhatsApp (caché por cliente indexada por destino), muestra "escribiendo" un tiempo proporcional al texto y envía. Mismos códigos locales (`numero_sin_whatsapp`, `verificacion_no_disponible`), `siVerificacionFalla`, `alAdvertir` y cancelación que el modo bot público. No marca leído: no hay `messageIds` en la vía interna.
- `./internal` exporta además `OpcionesClienteInterno`, `OpcionesModoBot` y sus tipos, `CODIGO_NUMERO_SIN_WHATSAPP`, `CODIGO_VERIFICACION_NO_DISPONIBLE` y los tipos de `chats`. Internamente el modo bot pasa a un núcleo compartido por ambas fachadas; el cliente público no cambia.
