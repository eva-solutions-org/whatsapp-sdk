/**
 * Result Pattern — contrato público del SDK.
 *
 * Toda operación pública de @eva_solutions/whatsapp-sdk retorna `Promise<Resultado<T>>`.
 * NUNCA se lanza una excepción para un flujo de negocio (HTTP, validación, parseo).
 *
 * Excepciones documentadas:
 * - Errores de programación al construir un cliente (apiKey / baseUrl / secreto inválidos):
 *   throw síncrono inmediato.
 * - Iteradores asíncronos y el cliente WebSocket, que reportan por callbacks / eventos.
 *
 * Forma del error (`ErrorResultado`):
 * - `error`: mensaje legible (el de la API cuando existe; nunca incluye credenciales).
 * - `codigo`: status HTTP. Los fallos de red / timeout / abort llegan como 503.
 * - `origen`: quién produjo el error. `"api"`: la API respondió (incluye un 503 real y un 2xx con
 *   forma inesperada). `"transporte"`: no hubo respuesta (red, DNS, TLS, timeout, abort, redirect);
 *   en un POST de envío el resultado es ambiguo (el mensaje pudo salir). `"local"`: el SDK lo
 *   rechazó antes de enviar (validación 422, ruta o cuerpo inválidos, fallo al obtener el token).
 * - `requestId`: header `x-request-id` de la respuesta, para soporte y trazabilidad.
 * - `detalles`: cuerpo `detalles` de un 422 (validación Zod aplanada: `fieldErrors`/`formErrors`).
 * - `codigoApi`: `error.code` de las respuestas `{ error: { code, message } }` (token de servicio),
 *   `numero_sin_whatsapp` (404 local) o `verificacion_no_disponible` (local, reintentable) del modo bot.
 * - `retryAfter` (solo 429): segundos sugeridos por `Retry-After`.
 */

export type CodigoErrorHttp =
  | 400
  | 401
  | 402
  | 403
  | 404
  | 408
  | 409
  | 413
  | 422
  | 429
  | 500
  | 502
  | 503;

/** Quién produjo un `ErrorResultado`: la API, el transporte (sin respuesta) o el propio SDK. */
export type OrigenError = "api" | "transporte" | "local";

interface ErrorBase {
  success: false;
  error: string;
  origen: OrigenError;
  requestId?: string;
  detalles?: unknown;
  codigoApi?: string;
}

export type ErrorResultado =
  | (ErrorBase & { codigo: Exclude<CodigoErrorHttp, 429> })
  | (ErrorBase & { codigo: 429; retryAfter?: number });

export type Resultado<T> = { success: true; data: T } | ErrorResultado;

export const esExitoso = <T>(r: Resultado<T>): r is { success: true; data: T } => r.success;

export const esFallido = <T>(r: Resultado<T>): r is ErrorResultado => !r.success;
