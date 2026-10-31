import type { CodigoErrorHttp, ErrorResultado, OrigenError } from "../types/result.js";

/** Status HTTP que el SDK conserva tal cual. El resto (418, 504...) cae en 502. */
const STATUS_VALIDOS = new Set<number>([
  400, 401, 402, 403, 404, 408, 409, 413, 422, 429, 500, 502, 503,
]);

/** Mensajes estables por status, usados cuando la API no trae uno propio. */
const MENSAJES_POR_STATUS: Record<number, string> = {
  400: "Petición inválida",
  401: "No autorizado",
  402: "Pago requerido",
  403: "Acceso prohibido",
  404: "Recurso no encontrado",
  408: "Tiempo de espera agotado",
  409: "Conflicto",
  413: "Payload demasiado grande",
  422: "Datos no procesables",
  429: "Demasiadas solicitudes",
  500: "Error interno del servicio",
  502: "Bad gateway upstream",
  503: "Servicio no disponible",
};

const MENSAJE_ERROR_RED = "Error de red al comunicarse con el servicio";
const MENSAJE_ERROR_REDIRECT = "Redirect inesperado rechazado por seguridad";
const MENSAJE_ERROR_ABORT_EXTERNO = "Operación cancelada";
const MENSAJE_ERROR_TIMEOUT = "Tiempo de espera agotado";
const LONGITUD_MAXIMA_MENSAJE = 500;

/** Header con el que la API devuelve el id de correlación (`middleware/request-id`). */
export const HEADER_REQUEST_ID = "x-request-id";

interface DatosExtra {
  requestId?: string | undefined;
  detalles?: unknown;
  codigoApi?: string | undefined;
  retryAfter?: number | undefined;
}

const crearError = (
  codigo: CodigoErrorHttp,
  origen: OrigenError,
  error: string,
  extra: DatosExtra = {},
): ErrorResultado => {
  const base = {
    success: false as const,
    error,
    origen,
    ...(extra.requestId !== undefined && { requestId: extra.requestId }),
    ...(extra.detalles !== undefined && { detalles: extra.detalles }),
    ...(extra.codigoApi !== undefined && { codigoApi: extra.codigoApi }),
  };
  if (codigo === 429) {
    return {
      ...base,
      codigo,
      ...(extra.retryAfter !== undefined && { retryAfter: extra.retryAfter }),
    };
  }
  return { ...base, codigo };
};

/**
 * Parsea el header `Retry-After`: delta-seconds o HTTP-date. Ausente o malformado:
 * `undefined` (nunca lanza).
 *
 * @internal
 */
export const parsearRetryAfter = (valor: string | null): number | undefined => {
  if (valor === null) {
    return undefined;
  }
  const recortado = valor.trim();
  if (recortado.length === 0) {
    return undefined;
  }
  if (/^\d+$/.test(recortado)) {
    return Number.parseInt(recortado, 10);
  }
  const fecha = Date.parse(recortado);
  if (!Number.isFinite(fecha)) {
    return undefined;
  }
  return Math.max(0, Math.round((fecha - Date.now()) / 1000));
};

interface ErrorApiExtraido {
  mensaje?: string;
  codigoApi?: string;
  detalles?: unknown;
}

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  valor !== null && typeof valor === "object" && !Array.isArray(valor);

const recortarMensaje = (mensaje: string): string =>
  mensaje.length > LONGITUD_MAXIMA_MENSAJE
    ? `${mensaje.slice(0, LONGITUD_MAXIMA_MENSAJE)}…`
    : mensaje;

/**
 * Extrae los datos del cuerpo de error de la API. Soporta los dos shapes reales:
 * - `{ error: string }` (errores de app, rate limit) con `detalles` opcional en los 422
 *   (`{ error: 'Body inválido', detalles: ZodError.flatten() }`).
 * - `{ error: { code, message } }` (401 S2S y errores del auth-sdk).
 *
 * @internal
 */
const extraerErrorApi = (body: unknown): ErrorApiExtraido => {
  if (!esObjeto(body)) {
    return {};
  }
  const resultado: ErrorApiExtraido = {};
  const error = body["error"];
  if (typeof error === "string" && error.length > 0) {
    resultado.mensaje = recortarMensaje(error);
  } else if (esObjeto(error)) {
    if (typeof error["message"] === "string" && error["message"].length > 0) {
      resultado.mensaje = recortarMensaje(error["message"]);
    }
    if (typeof error["code"] === "string") {
      resultado.codigoApi = error["code"];
    }
  }
  if (body["detalles"] !== undefined) {
    resultado.detalles = body["detalles"];
  }
  return resultado;
};

/**
 * Mapea una `Response` HTTP no-OK a `ErrorResultado`.
 *
 * El mensaje es el de la API cuando existe (viene de un servicio de confianza y nunca
 * contiene credenciales del consumidor); si no, uno estable por status. Un status fuera
 * de `CodigoErrorHttp` se reporta como 502.
 */
export const mapearErrorHttp = (response: Response, body?: unknown): ErrorResultado => {
  const status = response.status;
  const extraido = extraerErrorApi(body);
  const extra: DatosExtra = {
    requestId: response.headers.get(HEADER_REQUEST_ID) ?? undefined,
    detalles: extraido.detalles,
    codigoApi: extraido.codigoApi,
  };

  if (!STATUS_VALIDOS.has(status)) {
    return crearError(502, "api", `Status HTTP inesperado: ${String(status)}`, extra);
  }

  if (status === 429) {
    extra.retryAfter = parsearRetryAfter(response.headers.get("Retry-After"));
  }
  const mensaje = extraido.mensaje ?? MENSAJES_POR_STATUS[status] ?? `HTTP ${String(status)}`;
  return crearError(status as CodigoErrorHttp, "api", mensaje, extra);
};

/** Error técnico sin respuesta HTTP (red, DNS, TLS, timeout, abort): siempre 503, origen `transporte`. */
const mapearErrorRed = (mensaje: string): ErrorResultado => crearError(503, "transporte", mensaje);

export const mapearErrorRedTecnico = (): ErrorResultado => mapearErrorRed(MENSAJE_ERROR_RED);
export const mapearErrorRedirect = (): ErrorResultado => mapearErrorRed(MENSAJE_ERROR_REDIRECT);
export const mapearErrorAbortExterno = (): ErrorResultado =>
  mapearErrorRed(MENSAJE_ERROR_ABORT_EXTERNO);
export const mapearErrorTimeout = (): ErrorResultado => mapearErrorRed(MENSAJE_ERROR_TIMEOUT);

/** JSON inválido o `safeParse` Zod fallido en una respuesta 2xx: 502, origen `api`. */
export const mapearErrorParseo = (mensaje: string, requestId?: string): ErrorResultado =>
  crearError(502, "api", mensaje, { requestId });

/** Petición que el SDK rechaza antes de enviarla (ruta o cuerpo inválidos): 400, origen `local`. */
export const mapearErrorPeticion = (mensaje: string): ErrorResultado =>
  crearError(400, "local", mensaje);

/** Fallo del autenticador al preparar headers (p. ej. secreto S2S inutilizable): 500, origen `local`. */
export const mapearErrorAutenticacion = (): ErrorResultado =>
  crearError(500, "local", "No se pudo autenticar la petición");
