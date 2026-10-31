# Convenciones — `@eva_solutions/whatsapp-sdk`

## 1. Naming

Identificadores, comentarios y documentación en **español**, como la API y el SDK de Pagos. Los nombres de campo del contrato de la API se conservan tal cual (`phone`, `sourcePhone`, `messageType`), aunque estén en inglés.

| Cosa                    | Convención                                      | Ejemplo                                         |
| ----------------------- | ----------------------------------------------- | ----------------------------------------------- |
| Factory de cliente      | `crear<Nombre>`                                 | `crearCliente`, `crearClienteAdmin`             |
| Operación de un feature | verbo en infinitivo                             | `enviarTexto`, `listarProgramados`              |
| Iterador                | `iterar<Plural>`                                | `iterarProgramados`                             |
| Facade                  | `crearFacade<Feature>` / tipo `Facade<Feature>` | `crearFacadeMensajes`                           |
| Archivos                | kebab-case                                      | `crear-cliente.ts`                              |
| Tests                   | `*.mock.test.ts`                                | `tests/features/mensajes/mensajes.mock.test.ts` |

## 2. Paradigma funcional

Sin clases de negocio: factories y closures. La única clase es `ErrorConfiguracion`. Una operación es `(http) => (input, opciones?) => Promise<Resultado<T>>`; un facade es un objeto plano que las agrupa.

Firma unificada en todo el SDK: `(input, opciones?: OpcionesOperacion)`; sin input, `(opciones?)`.

## 3. Result Pattern

- Toda operación pública retorna `Promise<Resultado<T>>`. Nunca lanza por HTTP, validación ni parseo.
- Excepciones documentadas: `ErrorConfiguracion` al construir un cliente; iteradores `iterar…` (lanzan `Error` con el `Resultado` en `cause`); el cliente WebSocket (reporta por eventos).

## 4. Validación en los bordes

- **Entrada del consumidor:** `validarEntrada(schema, input)` antes de enviar y de firmar. Falla → `422` con `detalles` y sin request.
- **Respuesta de la API:** `schemaRespuesta` con `safeParse`. Falla → `502`.
- **Enums de respuesta:** `enumTolerante` (acepta cualquier string); los de entrada son `z.enum` estrictos.
- **Segmentos de path:** siempre `segmentoRuta(valor)`. Los ids vacíos se rechazan en el schema (`idSchema`).

## 5. Imports

Entre features y desde los entry points, solo vía el `index.ts` (barrel) de cada feature o módulo del core. Los imports llevan extensión `.js` (ESM con TypeScript). `src/index.ts` exporta tipos de los features con `export type *`; los nombres de tipo deben ser únicos entre features.

## 6. Tests

- Sufijo `*.mock.test.ts`: `fetch` y `WebSocket` simulados, sin red.
- Helpers en `tests/helpers/` (`mock-fetch`, `fixtures`, `ayudas-s2s`, `iteradores`).
- `tests/s2s/contrato-auth-sdk.mock.test.ts` compara la firma S2S con la de `@eva_solutions/auth-sdk`: si el algoritmo cambia allá, falla aquí.

## 7. JSDoc

Documenta el contrato observable (códigos que puede devolver, si se reintenta, efectos laterales), no la implementación. Cita el endpoint de la API cuando el comportamiento viene de ella.

## 8. Secretos nunca en errores

Ningún mensaje de error, log o `ErrorConfiguracion` incluye `apiKey`, `secretoHex`, secreto de webhook ni el `baseUrl` recibido. Un test debe cubrirlo cuando se agrega un punto de error nuevo.

## 9. Anti-patterns

- `throw` por un fallo HTTP o de validación.
- Reintentar un `POST` o un `GET` con efecto lateral.
- Construir paths con template strings sin `segmentoRuta`.
- Importar de un archivo interno de otro feature (saltándose el barrel).
- Una capa `infrastructure/` que solo reenvía llamadas al `HttpClient`.
