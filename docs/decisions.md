# Architecture Decision Records (ADRs) — `@eva_solutions/whatsapp-sdk`

Decisiones de arquitectura de la versión inicial (0.1.0). Los ADRs son **append-only**: una decisión reemplazada no se borra ni se renumera, solo cambia su campo `Estado` y se agrega una nota.

El "por qué" de cada ADR proviene de los comentarios del código y de las decisiones registradas durante la construcción del SDK (campo **Fuente**). Donde no quedó registrada una alternativa descartada, el ADR lo dice en vez de reconstruirla.

| ADR                                                                    | Tema                                                  | Estado  |
| ---------------------------------------------------------------------- | ----------------------------------------------------- | ------- |
| [001](#adr-001--plantilla-de-pagos-sdk-con-subpaths-por-superficie)    | Plantilla del SDK de Pagos + subpaths por superficie  | Vigente |
| [002](#adr-002--firma-s2s-propia-con-test-de-contrato-contra-auth-sdk) | Firma S2S propia con test de contrato contra auth-sdk | Vigente |
| [003](#adr-003--sin-capa-adapter-por-feature)                          | Sin capa adapter por feature                          | Vigente |
| [004](#adr-004--validación-local-con-422-antes-de-enviar)              | Validación local con 422 antes de enviar              | Vigente |
| [005](#adr-005--enums-y-eventos-tolerantes-a-valores-nuevos-de-la-api) | Enums y eventos tolerantes a valores nuevos           | Vigente |
| [006](#adr-006--reintentos-solo-en-get-sin-efecto-y-timeout-de-35-s)   | Reintentos solo en GET sin efecto; timeout de 35 s    | Vigente |
| [007](#adr-007--media-siempre-como-multipart)                          | Media siempre como multipart                          | Vigente |

---

## ADR-001 — Plantilla de Pagos SDK con subpaths por superficie

**Estado**: Vigente
**Fecha**: 2026-10-30

### Contexto

Se pidió crear el SDK de Whatsapp-api tomando como guía los SDK existentes: Procesador-de-pagos-sdk y Auth SDK. La API tiene superficies con autenticación distinta: `x-api-key`, webhooks firmados, WebSocket, administración S2S y envío interno S2S. El criterio pedido para elegir la plantilla fue "lo que sea más completo y mejor a largo plazo".

### Decisión

Un único paquete `@eva_solutions/whatsapp-sdk` con la estructura del SDK de Pagos (español, Result Pattern, Zod, tsdown, Vitest, Changesets, ESM + CJS) y **cinco subpaths** como el Auth SDK: `.`, `./webhooks`, `./ws`, `./admin`, `./internal`.

### Alternativas consideradas

No quedó registrado qué otras formas de empaquetado se evaluaron (por ejemplo, varios paquetes). La decisión registrada es combinar la estructura de Pagos con el esquema de subpaths de Auth.

### Consecuencias

- (+) Quien solo envía mensajes no carga WebCrypto de webhooks ni el cliente WebSocket: cada superficie vive en su entry.
- (+) Un solo versionado y un solo release.
- (−) Los cinco subpaths comparten versión: un cambio en uno sube la versión de todos.

**Fuente**: Engram `odd/whatsapp-sdk/tasks` (S3, D2); JSDoc de `src/webhooks.ts`.

---

## ADR-002 — Firma S2S propia con test de contrato contra auth-sdk

**Estado**: Vigente
**Fecha**: 2026-10-30

### Contexto

`./admin` e `./internal` se autentican con una firma HMAC service-to-service. El dueño del algoritmo y del verificador que usa la API es `@eva_solutions/auth-sdk`.

### Decisión

El SDK reimplementa la firma con WebCrypto en `src/core/s2s` para **no depender del auth-sdk en runtime**. Un test de contrato (`tests/s2s/contrato-auth-sdk.mock.test.ts`) verifica, contra el auth-sdk real, que ambos producen el mismo canonical string y la misma firma. `@eva_solutions/auth-sdk` es solo una devDependency, desde un tarball versionado en `vendor/`.

### Alternativas consideradas

Depender del auth-sdk en runtime (descartada por la razón de arriba, según el código). No quedó registrado otro motivo.

### Consecuencias

- (+) La única dependencia de runtime sigue siendo `zod`; la firma corre en cualquier runtime con `crypto.subtle`.
- (−) El algoritmo existe duplicado. Si el auth-sdk cambia el contrato, el test falla y hay que actualizar el tarball de `vendor/` y la firma.
- (−) El tarball de `vendor/` se versiona en el repo.

**Fuente**: comentarios de `src/core/s2s/firmar-s2s.ts`; Engram `odd/whatsapp-sdk/tasks` (D4).

---

## ADR-003 — Sin capa adapter por feature

**Estado**: Vigente
**Fecha**: 2026-10-30

### Contexto

Los features con `x-api-key` tenían una capa `infrastructure/*-http-adapter`. Cada adapter solo reenviaba path, schema y `signal` al `HttpClient`.

### Decisión

Se eliminaron los adapters: `application` recibe el `HttpClient` y llama `http.get/post/…` directo, como ya hacían `./admin` e `./internal`. Todas las operaciones usan la firma `(input, opciones?: OpcionesOperacion)`; sin input, `(opciones?)`.

### Alternativas consideradas

Conservar el adapter por simetría con el SDK de Pagos: descartada porque era una capa pass-through.

### Consecuencias

- (+) Menos piezas y una sola estructura en todos los features.
- (+) Los iteradores propagan `opciones` (`signal`, `timeout`) a cada página.
- (−) `application` conoce los paths de la API. `infrastructure/` queda solo donde hay un adaptador real (`webhooks`, `ws`).

**Fuente**: Engram `conventions/whatsapp-sdk-core`.

---

## ADR-004 — Validación local con 422 antes de enviar

**Estado**: Vigente
**Fecha**: 2026-10-30

### Contexto

Un input inválido llegaría a la API (y, en S2S, se firmaría) para recibir un rechazo.

### Decisión

`validarEntrada` valida la entrada con Zod antes de enviar y de firmar. Un fallo retorna `Resultado` con `codigo: 422` y `detalles` en el mismo formato `formErrors`/`fieldErrors` que usa la API en su propio 422; no sale ninguna request. El mensaje nombra el campo y el motivo, nunca el valor recibido.

### Alternativas consideradas

No quedó registrada una alternativa.

### Consecuencias

- (+) El consumidor trata igual un 422 local y uno de la API, sin lanzar excepciones (Result Pattern).
- (+) Los valores recibidos no se repiten en los mensajes de error.
- (−) Los schemas del SDK duplican reglas de la API (por ejemplo, el formato de `phone`) y deben mantenerse alineados con ella.
- (−) Un 422 no distingue en `codigo` si fue local o remoto; el mensaje local empieza con `Entrada inválida:`.

**Fuente**: JSDoc de `src/core/validacion/validar-entrada.ts`.

---

## ADR-005 — Enums y eventos tolerantes a valores nuevos de la API

**Estado**: Vigente
**Fecha**: 2026-10-30

### Contexto

La API puede agregar valores a un enum de respuesta o tipos de evento nuevos. Un parseo estricto rompería la respuesta completa en consumidores con una versión anterior del SDK.

### Decisión

- Los enums de **respuesta** usan `enumTolerante`: aceptan cualquier string, y el tipo conserva el autocompletado de los valores conocidos. Los enums de **entrada** siguen siendo estrictos.
- Un evento con `type` desconocido, o un `message` con `messageType` nuevo cuyo resto es válido, se entrega como `EventoDesconocido` con `conocido: false`. En el WebSocket se emite como evento `desconocido`.
- Un evento de tipo **conocido** con forma inválida sigue siendo un fallo (`422` en webhooks, evento `error` en WebSocket).
- La rama "desconocido" se resuelve en `clasificarEvento`, no dentro de los schemas públicos: un fallback de `messageType` dentro del schema rompe el narrowing de `content` por `messageType` en TypeScript.

### Alternativas consideradas

Un fallback dentro del schema público de `message`: descartado porque TypeScript mantiene la variante `string` al comparar `=== "text"` y se pierde el narrowing (ni un brand lo evita).

### Consecuencias

- (+) Una API que evoluciona no rompe consumidores desplegados.
- (−) El consumidor debe manejar la rama `conocido === false` (o ignorarla).
- (−) Un valor desconocido en un enum de respuesta no avisa: el tipo es `Conocido | (string & {})`.

**Fuente**: Engram `whatsapp-sdk: fixes de revision`; JSDoc de `enumTolerante` y de `clasificarEvento`.

---

## ADR-006 — Reintentos solo en GET sin efecto y timeout de 35 s

**Estado**: Vigente
**Fecha**: 2026-10-30

### Contexto

Reintentar un envío puede duplicar un mensaje; en S2S, además, cada firma lleva un nonce de un solo uso. Algunos GET tienen efecto lateral (el QR crea la sesión y espera hasta 30 s; el secreto de webhook envía un WhatsApp). Un fallo por red o timeout en un envío es ambiguo: el mensaje pudo salir.

### Decisión

- Se reintentan solo los `GET` sin efecto ante red/timeout, 5xx y 429, con backoff exponencial y `Retry-After`.
- `POST`, `PUT` y `PATCH` no se reintentan. Todos los `DELETE` y los `GET` con efecto fijan `reintentar: false`.
- Existe el override por petición `reintentar: true | false` en el `HttpClient`.
- Timeout por defecto de **35 s por intento**, para cubrir la espera de QR de la API (hasta 30 s); sobreescribible por cliente y por operación.

### Alternativas consideradas

Reintentar `DELETE` por ser idempotente por método HTTP: se fijó `reintentar: false` en todos tras la revisión del código (hallazgo confirmado por dos revisores). El motivo detallado no quedó registrado.

### Consecuencias

- (+) El SDK no duplica envíos por sí solo.
- (−) El consumidor decide cómo manejar un `503` ambiguo en un envío.
- (−) El timeout por defecto es largo para operaciones rápidas: usa `timeout` por operación.

**Fuente**: Engram `whatsapp-sdk: fixes de revision`; JSDoc de `src/core/http-client/` y de las operaciones.

---

## ADR-007 — Media siempre como multipart

**Estado**: Vigente
**Fecha**: 2026-10-30

### Contexto

Los endpoints `POST /v1/send/{image,video,pdf,gif}` solo documentan `multipart/form-data`. Un body JSON se interpreta como un formulario vacío y devuelve 422. La API valida el MIME del archivo.

### Decisión

El SDK envía siempre `FormData`: `url` como campo de texto y `file` como `Blob`. Un archivo en bytes exige `tipoContenido`.

### Alternativas consideradas

Enviar JSON cuando se usa `url`: descartada porque la API lo rechaza.

### Consecuencias

- (+) Funciona con los dos orígenes (`url` y `file`) contra el contrato real.
- (−) Con `FormData` el body firmado en S2S sería vacío (la API respondería `401`): el autenticador S2S declara `soportaMultipart: false` y el cliente rechaza un `FormData` con `400` local. No aplica hoy porque la media no se envía por `./internal` (que usa `mediaUrl` en JSON).

**Fuente**: Engram `whatsapp-sdk T2: media send es multipart-only`.

---

## ADR-008 — `./internal` solo HMAC; Auth - API conserva su adaptador JWT

**Estado**: Vigente
**Fecha**: 2026-10-31

### Contexto

`POST /v1/internal/messages/*` acepta dos credenciales: HMAC S2S (`X-Eva-*`) de un service client registrado en Whatsapp-api, o un JWT de servicio en `Authorization: Bearer`. El JWT solo puede emitirlo Auth - API: es el único firmante cuya clave Whatsapp-api ya conoce (el JWKS de Auth, que también usa para el login). Auth adoptó el JWT para no compartir un secreto con Whatsapp-api y cortar la dependencia circular de arranque entre ambos (ADR 0006 de Auth - API). Hoy Auth es el único que llama a `/v1/internal/*`.

### Decisión

`./internal` firma solo con HMAC. Auth - API no usa este SDK: conserva su adaptador propio, verificado en sus tests contra el `verifyServiceJwt` real. Un servicio nuevo que necesite enviar mensajes se registra como service client (`./admin`, `serviceClients.crear` y `telefonosOrigen.agregar`) y usa `crearClienteInterno`.

### Alternativas consideradas

- **Firmante JWT inyectable en `./internal` para que Auth use el SDK**: descartada por ahora. Sería una extensión para un solo consumidor, el ahorro es poco (unas 90 líneas ya probadas) y agrega un bundle en Workers y versiones coordinadas entre repos.
- **Volver Auth a HMAC**: descartada. Reintroduce el secreto compartido y la dependencia circular que el ADR 0006 de Auth eliminó.

### Consecuencias

- (+) Los consumidores nuevos funcionan hoy con el SDK, sin cambios en ningún repo.
- (−) El contrato de `/v1/internal/messages/send` existe en dos lugares (este SDK y el adaptador de Auth).
- **Cuándo revisarlo**: el objetivo de la plataforma es que Auth emita JWT de servicio a todos los servicios (OAuth2 _client credentials_) antes de conectar un segundo producto, porque con varios productos y servicios compartidos los secretos HMAC se multiplican por cada par. En ese mismo cambio, `./internal` agrega Bearer y Auth migra a este SDK.
