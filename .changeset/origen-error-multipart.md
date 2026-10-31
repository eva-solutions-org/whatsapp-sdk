---
"@eva_solutions/whatsapp-sdk": minor
---

`ErrorResultado` incluye `origen` (`"api" | "transporte" | "local"`) para distinguir un 503 real de la API de un fallo de red/timeout/cancelación (resultado ambiguo en un POST) y de un rechazo local. Un body `FormData` con el cliente S2S (`./admin`, `./internal`) se rechaza con 400 local en vez de enviar una firma inválida, y el `Content-Type` manual del consumidor se descarta con `FormData`. `./ws` ya no arrastra el cliente REST. `sideEffects: false`.
