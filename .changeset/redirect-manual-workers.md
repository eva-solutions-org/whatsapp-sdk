---
"@eva_solutions/whatsapp-sdk": patch
---

Compatibilidad con Cloudflare Workers: usa `redirect: "manual"` y rechaza las respuestas 3xx, porque `redirect: "error"` hace fallar `fetch` en Workers.
