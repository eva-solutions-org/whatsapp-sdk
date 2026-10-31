# Seguridad — `@eva_solutions/whatsapp-sdk`

## 1. Modelo de amenazas

### Activos

| Activo                        | Dónde vive  | Quién lo ve                           |
| ----------------------------- | ----------- | ------------------------------------- |
| `apiKey`                      | tu servidor | `x-api-key`, `Sec-WebSocket-Protocol` |
| `secretoHex` (service client) | tu servidor | solo se usa para firmar; nunca viaja  |
| Secreto del webhook           | tu servidor | solo se usa para verificar            |

### Amenazas consideradas

| Amenaza                                                       | Mitigación en el SDK                                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Credencial enviada a un destino inseguro o ambiguo            | `baseUrl` validada: `https` (o `http` en loopback), sin credenciales, path, query ni fragmento                                  |
| Redirect hacia otro host que recibe los headers               | `redirect: "error"`: se rechaza con `503` (`origen: "transporte"`)                                                              |
| Credencial en logs o errores                                  | Ningún mensaje la incluye; el `error` de la API se recorta a 500 caracteres                                                     |
| Webhook falsificado                                           | HMAC-SHA256 con comparación en tiempo constante; fail-closed (`401`)                                                            |
| Webhook con cuerpo enorme                                     | Tope de 1 MiB por defecto (`413`)                                                                                               |
| Path traversal o inyección en segmentos de ruta               | `segmentoRuta` + rechazo de paths que cambian al normalizarse (`400`)                                                           |
| Replay de una petición S2S                                    | Nonce nuevo y de un solo uso por intento; timestamp firmado                                                                     |
| Mensaje WebSocket malicioso o gigante                         | Tope de longitud (1 MiB), JSON y forma validados; fallo = evento `error`, no excepción                                          |
| Entrada del consumidor que corrompe la petición               | Validación Zod local antes de enviar y de firmar                                                                                |
| Firma S2S inválida por un body `FormData` (se firmaría vacío) | El autenticador S2S no soporta multipart: `400` local, sin llamar a la red. Un `Content-Type` manual con `FormData` se descarta |

## 2. Solo en el servidor

`apiKey` y `secretoHex` son secretos de larga vida. **No uses este SDK en un navegador** ni los pases al frontend: cualquiera con la key envía mensajes y consume el saldo de tu cuenta. En un frontend, llama a tu propio backend.

## 3. Webhooks

### Verificación

Verifica siempre sobre los **bytes crudos** del body (`verificarWebhookDesdeRequest` lo hace; si tu framework ya lo leyó, pasa `{ cuerpoCrudo }`). Un JSON re-serializado cambia los bytes y la firma no coincide. El formato esperado es `X-Webhook-Signature: sha256=<hex64 minúsculas>`; mayúsculas se rechazan.

### Sin timestamp: deduplica

La firma cubre solo el cuerpo, **no un timestamp en un header**, así que un atacante que capture un webhook válido puede reenviarlo y seguirá verificando. El SDK no puede detectarlo (no guarda estado). Deduplica en tu handler: guarda un identificador del evento (`data.messageId` cuando exista, o `type` + `phone` + `timestamp`) por un tiempo, y haz idempotente lo que dispara el evento.

### Valida lo que haces con el evento

El evento ya viene tipado y validado, pero los campos de texto (`content.text`, `caption`, `displayName`…) son entrada de terceros que llegó por WhatsApp. Trátalos como no confiables.

### Secreto filtrado

`cliente.webhookSecret.enviar()` solo reenvía por WhatsApp el secreto vigente; el SDK no tiene una operación para rotarlo. Si sospechas que se filtró, la rotación se gestiona del lado de la API.

## 4. S2S

- `secretoHex` nunca aparece en errores ni logs. Un secreto no hex lanza `ErrorConfiguracion` al construir el cliente.
- Si el secreto se filtra, un administrador debe rotarlo (`admin.serviceClients.rotarSecret`): el anterior deja de servir al instante.
- `./admin` necesita el scope `admin`; `./internal`, el scope del tipo de mensaje y un `sourcePhone` en la allowlist. Usa un service client distinto por servicio y con los scopes mínimos.
- El `secret` de un service client recién creado se devuelve **una sola vez**: guárdalo en tu gestor de secretos.

## 5. Qué NO cubre el SDK

- Ver el cuadro en el [README](../README.md#qué-no-cubre-el-sdk): rutas del panel con cookie de sesión, webhook entrante de pagos y el JWT de servicio de Auth.
- No hay rate limiting en cliente: respeta `retryAfter` en los `429`.
- No hay deduplicación de webhooks ni almacenamiento de estado.

## 6. Recomendaciones

- Una `baseUrl` por entorno, leída de configuración del servidor.
- Usa `signal` para cancelar operaciones al apagar el proceso.
- Tras un `503` en un envío con `origen: "transporte"`, asume que el mensaje pudo salir antes de reenviar. Con `origen: "api"` la API respondió el `503`.
- No loguees el `Resultado` completo de un `crearClienteAdmin().serviceClients.crear` (trae el secreto).

## 7. Reportar vulnerabilidades

Ver [SECURITY.md](../SECURITY.md).
