# Seguridad — `@eva_solutions/whatsapp-sdk`

## 1. Modelo de amenazas

### Activos

| Activo                   | Dónde vive  | Quién lo ve                           |
| ------------------------ | ----------- | ------------------------------------- |
| `apiKey`                 | tu servidor | `x-api-key`, `Sec-WebSocket-Protocol` |
| Token de servicio (Auth) | tu servidor | `Authorization: Bearer`; vive ≤ 300 s |
| Secreto del webhook      | tu servidor | solo se usa para verificar            |

### Amenazas consideradas

| Amenaza                                            | Mitigación en el SDK                                                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Credencial enviada a un destino inseguro o ambiguo | `baseUrl` validada: `https` (o `http` en loopback), sin credenciales, path, query ni fragmento                               |
| Redirect hacia otro host que recibe los headers    | `redirect: "manual"`: se rechaza con `503` (`origen: "transporte"`)                                                           |
| Credencial en logs o errores                       | Ningún mensaje la incluye; el `error` de la API se recorta a 500 caracteres                                                  |
| Webhook falsificado                                | HMAC-SHA256 con comparación en tiempo constante; fail-closed (`401`)                                                         |
| Webhook con cuerpo enorme                          | Tope de 1 MiB por defecto (`413`)                                                                                            |
| Path traversal o inyección en segmentos de ruta    | `segmentoRuta` + rechazo de paths que cambian al normalizarse (`400`)                                                        |
| Token de servicio robado o reutilizado             | El SDK no lo guarda (lo pide a `obtenerToken` en cada intento); vida corta, una audiencia y permisos mínimos los impone Auth |
| Mensaje WebSocket malicioso o gigante              | Tope de longitud (1 MiB), JSON y forma validados; fallo = evento `error`, no excepción                                       |
| Entrada del consumidor que corrompe la petición    | Validación Zod local antes de enviar                                                                                         |
| `Content-Type` manual que rompe un body `FormData` | Se descarta para que `fetch` ponga el boundary                                                                               |

## 2. Solo en el servidor

La `apiKey` es un secreto de larga vida y los tokens de servicio dan acceso a `/v1/admin/*` y `/v1/internal/*`. **No uses este SDK en un navegador** ni los pases al frontend: cualquiera con la key envía mensajes y consume el saldo de tu cuenta. En un frontend, llama a tu propio backend.

## 3. Webhooks

### Verificación

Verifica siempre sobre los **bytes crudos** del body (`verificarWebhookDesdeRequest` lo hace; si tu framework ya lo leyó, pasa `{ cuerpoCrudo }`). Un JSON re-serializado cambia los bytes y la firma no coincide. El formato esperado es `X-Webhook-Signature: sha256=<hex64 minúsculas>`; mayúsculas se rechazan.

### Sin timestamp: deduplica

La firma cubre solo el cuerpo, **no un timestamp en un header**, así que un atacante que capture un webhook válido puede reenviarlo y seguirá verificando. El SDK no puede detectarlo (no guarda estado). Deduplica en tu handler: guarda un identificador del evento (`data.messageId` cuando exista, o `type` + `phone` + `timestamp`) por un tiempo, y haz idempotente lo que dispara el evento.

### Valida lo que haces con el evento

El evento ya viene tipado y validado, pero los campos de texto (`content.text`, `caption`, `displayName`…) son entrada de terceros que llegó por WhatsApp. Trátalos como no confiables.

### Secreto filtrado

`cliente.webhookSecret.enviar()` solo reenvía por WhatsApp el secreto vigente; el SDK no tiene una operación para rotarlo. Si sospechas que se filtró, la rotación se gestiona del lado de la API.

## 4. Tokens de servicio (`./admin`, `./internal`)

- El token nunca aparece en errores ni logs del SDK. Si `obtenerToken` falla, el resultado es un `500` local genérico, sin el motivo; solo se expone en `detalles` un `code` OAuth no sensible (`invalid_client`...), nunca el mensaje. Ninguna excepción de `obtenerToken` o `invalidarToken` escapa.
- El SDK no cachea el token: lo pide en cada intento. El caché, la renovación anticipada y la deduplicación de pedidos son del proveedor que pasas.
- Un `401` invalida el token (`invalidarToken(tokenRechazado)`) y reintenta **una vez**; no hay bucle. Sin `invalidarToken` no se reintenta. Tampoco duplica un envío: el `401` significa que la API no procesó la request.
- Un `403` es permiso insuficiente (`./admin` necesita `admin`; `./internal`, el permiso del tipo de mensaje), un `sub` sin registro habilitado en Whatsapp-api o un `sourcePhone` fuera de la allowlist. Pide a Auth una concesión por servicio con los permisos mínimos.
- Deshabilitar el registro local (`admin.serviceClients.actualizar({ id, enabled: false })`) corta `./internal` de inmediato; revocar la concesión en Auth no afecta a los tokens ya emitidos hasta que venzan (≤ 300 s).
- El admin de Whatsapp-api es un service client **de Auth** con el permiso `admin`; no requiere registro local.

## 5. Qué NO cubre el SDK

- Ver el cuadro en el [README](../README.md#qué-no-cubre-el-sdk): rutas del panel con cookie de sesión, webhook entrante de pagos y la obtención de tokens de servicio (es del proveedor).
- No hay rate limiting en cliente: respeta `retryAfter` en los `429`.
- No hay deduplicación de webhooks ni almacenamiento de estado.

## 6. Recomendaciones

- Una `baseUrl` por entorno, leída de configuración del servidor.
- Usa `signal` para cancelar operaciones al apagar el proceso.
- Tras un `503` en un envío con `origen: "transporte"`, asume que el mensaje pudo salir antes de reenviar. Con `origen: "api"` la API respondió el `503`.
- No loguees los headers de las requests ni el valor que devuelve `obtenerToken`.

## 7. Reportar vulnerabilidades

Ver [SECURITY.md](../SECURITY.md).
