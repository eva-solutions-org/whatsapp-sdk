import type { ZodType } from "zod";
import type { Resultado } from "../types/result.js";
import type { Autenticador } from "./autenticador.js";
import {
  HEADER_REQUEST_ID,
  mapearErrorAbortExterno,
  mapearErrorAutenticacion,
  mapearErrorHttp,
  mapearErrorParseo,
  mapearErrorPeticion,
  mapearErrorRedirect,
  mapearErrorRedTecnico,
  mapearErrorTimeout,
  parsearRetryAfter,
} from "./mapear-error.js";
import {
  REINTENTOS_POR_DEFECTO,
  calcularEsperaBackoff,
  dormirAbortable,
  esMetodoIdempotente,
  esStatusReintentable,
} from "./reintentos.js";
import type { OpcionesReintentos } from "./reintentos.js";

/**
 * Opciones del factory `crearHttpClient`.
 *
 * - `baseUrl`: origin ya validado (`validarBaseUrl`); las rutas se resuelven contra él.
 * - `autenticador`: agrega los headers de auth en cada intento (x-api-key o Bearer). Si declara
 *   `ante401`, un `401` lo invoca y reintenta una vez (ver `Autenticador`).
 * - `timeout`: ms por intento, vía `AbortSignal.timeout()`.
 * - `headersExtra`: headers del consumidor. Los del autenticador y los internos GANAN
 *   ante colisión (las claves se normalizan a minúsculas).
 * - `fetchImpl`: `fetch` inyectable (tracing, tests). Sin red real en los tests.
 * - `clientSignal`: signal global del cliente (shutdown del proceso).
 * - `reintentos`: política de reintentos (ver `OpcionesReintentos`).
 * - `dormir` / `aleatorio`: costuras para tests deterministas (no son API pública).
 */
export interface OpcionesHttpClient {
  baseUrl: string;
  autenticador: Autenticador;
  timeout: number;
  headersExtra?: Record<string, string> | undefined;
  fetchImpl: typeof globalThis.fetch;
  clientSignal?: AbortSignal | undefined;
  reintentos?: OpcionesReintentos | undefined;
  dormir?: ((ms: number, signal?: AbortSignal) => Promise<void>) | undefined;
  aleatorio?: (() => number) | undefined;
}

/**
 * Opciones por operación HTTP.
 *
 * - `body`: objeto serializado como JSON, o `FormData` (multipart; el Content-Type del consumidor
 *   se descarta para que fetch ponga el boundary).
 * - `schemaRespuesta`: valida el cuerpo 2xx. Si el cuerpo es exactamente `{ data }`, el
 *   schema recibe el contenido de `data`; si trae otras claves (`{ data, pagination }`,
 *   `{ message }`...) recibe el JSON completo.
 * - `signal`: cancelación de esta operación.
 * - `timeout`: ms por intento de esta operación (número > 0); sobreescribe el del cliente.
 * - `reintentar`: override de la política por método. `false` desactiva los reintentos de esta
 *   operación (GET/DELETE con efecto lateral no idempotente: enviar un WhatsApp, disparar una
 *   reconexión); `true` los habilita aunque el método no sea idempotente. Sin definir, aplica el
 *   default por método (solo GET y DELETE).
 */
export interface OpcionesRequest<T> {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined> | undefined;
  schemaRespuesta?: ZodType<T> | undefined;
  signal?: AbortSignal | undefined;
  timeout?: number | undefined;
  reintentar?: boolean | undefined;
  /**
   * `"json"` (default) parsea el body como JSON. `"bytes"` entrega el body crudo como
   * `RespuestaBinaria` (p. ej. el QR en PNG) e ignora `schemaRespuesta`.
   */
  respuesta?: "json" | "bytes" | undefined;
}

/** Body binario de una respuesta 2xx con `respuesta: "bytes"`. */
export interface RespuestaBinaria {
  bytes: Uint8Array;
  /** Header `Content-Type` de la respuesta (`""` si no vino). */
  tipoContenido: string;
}

type OpcionesMetodo<T> = Omit<OpcionesRequest<T>, "method" | "path" | "body">;

/**
 * Resuelve `path` contra `baseUrl` y aplica el query (omite `undefined`).
 * Retorna `null` si el path no es seguro: debe empezar con `/`, no salir del origin
 * (`//host`) ni cambiar al normalizarse (`..`, `%2e%2e`, `?` incrustado). Los segmentos
 * dinámicos deben pasar por `segmentoRuta`.
 */
const construirUrl = (
  baseUrl: string,
  path: string,
  query: OpcionesRequest<unknown>["query"],
): URL | null => {
  if (!path.startsWith("/")) {
    return null;
  }
  const url = new URL(path, baseUrl);
  if (url.origin !== baseUrl || url.pathname !== path) {
    return null;
  }
  if (query !== undefined) {
    for (const [clave, valor] of Object.entries(query)) {
      if (valor !== undefined) {
        url.searchParams.set(clave, String(valor));
      }
    }
  }
  return url;
};

interface CuerpoPreparado {
  contenido: string | FormData | undefined;
  /** Bytes EXACTOS del body (vacío con `FormData`). */
  bytes: Uint8Array;
  esJson: boolean;
  esMultipart: boolean;
}

const codificador = new TextEncoder();

const prepararCuerpo = (body: unknown): CuerpoPreparado | null => {
  if (body === undefined) {
    return { contenido: undefined, bytes: new Uint8Array(0), esJson: false, esMultipart: false };
  }
  if (body instanceof FormData) {
    return { contenido: body, bytes: new Uint8Array(0), esJson: false, esMultipart: true };
  }
  try {
    const json = JSON.stringify(body);
    return { contenido: json, bytes: codificador.encode(json), esJson: true, esMultipart: false };
  } catch {
    return null;
  }
};

const esErrorAbort = (err: unknown): boolean =>
  err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");

/** Con `redirect: "manual"`: 3xx en Node y Workers, `opaqueredirect` en navegadores. */
const esRespuestaRedirect = (response: Response): boolean =>
  response.type === "opaqueredirect" ||
  (response.status >= 300 && response.status < 400 && response.status !== 304);

interface ResultadoIntento<T> {
  resultado: Resultado<T>;
  reintentable: boolean;
  /** `true` si la API respondió 401 (el autenticador puede renovar su credencial). */
  noAutorizado?: boolean;
  /** Headers que viajaron en el intento que recibió el 401 (el autenticador ve qué token se rechazó). */
  headersEnviados?: Headers;
  /** Espera pedida por la API con `Retry-After`, en ms. */
  esperaSugeridaMs?: number;
}

const envelopeSoloData = (json: unknown): json is { data: unknown } =>
  json !== null &&
  typeof json === "object" &&
  "data" in json &&
  Object.keys(json as Record<string, unknown>).length === 1;

const leerJson = async (response: Response): Promise<{ texto: string; json: unknown } | null> => {
  const texto = await response.text();
  if (texto.length === 0) {
    return { texto, json: undefined };
  }
  try {
    return { texto, json: JSON.parse(texto) as unknown };
  } catch {
    return null;
  }
};

/**
 * Cliente HTTP del SDK, compartido por `.`, `./admin` y `./internal`.
 *
 * Política:
 * - Siempre retorna `Resultado<T>`; nunca lanza por un fallo de red o HTTP.
 * - `redirect: "manual"`: no sigue redirects (evita filtrar credenciales a otro host); `"error"`
 *   no existe en Cloudflare Workers (`fetch` lanza TypeError).
 * - Timeout por intento + `clientSignal` + `signal` de la operación, combinados.
 * - Reintentos por defecto solo en GET/DELETE (override por operación: `reintentar`) ante
 *   red/timeout, 5xx y 429, con backoff exponencial y
 *   respetando `Retry-After`. El autenticador corre en cada intento.
 * - Si el autenticador declara `ante401`, un 401 lo invoca (con los headers rechazados) y reintenta
 *   UNA vez (también en POST: el servidor no procesó la request), sin consumir el presupuesto de
 *   reintentos. Si `ante401` lanza, se devuelve el 401 sin reintentar.
 * - Las credenciales nunca aparecen en mensajes de error.
 */
export const crearHttpClient = (opciones: OpcionesHttpClient) => {
  const { baseUrl, autenticador, timeout, headersExtra, fetchImpl, clientSignal } = opciones;
  const politica = { ...REINTENTOS_POR_DEFECTO, ...opciones.reintentos };
  const dormir = opciones.dormir ?? dormirAbortable;
  const aleatorio = opciones.aleatorio ?? Math.random;

  const construirHeaders = async (
    method: string,
    url: URL,
    cuerpo: CuerpoPreparado,
  ): Promise<Headers> => {
    const headers = new Headers();
    headers.set("accept", "application/json");
    if (headersExtra !== undefined) {
      for (const [clave, valor] of Object.entries(headersExtra)) {
        headers.set(clave.toLowerCase(), valor);
      }
    }
    if (cuerpo.esJson) {
      headers.set("content-type", "application/json");
    } else if (cuerpo.esMultipart) {
      // Sin content-type fetch genera el boundary; uno manual del consumidor lo rompe.
      headers.delete("content-type");
    }
    const headersAuth = await autenticador({ method, url, cuerpo: cuerpo.bytes });
    for (const [clave, valor] of Object.entries(headersAuth)) {
      headers.set(clave.toLowerCase(), valor);
    }
    return headers;
  };

  const procesarRespuesta = async <T>(
    response: Response,
    schemaRespuesta: ZodType<T> | undefined,
    modo: "json" | "bytes",
  ): Promise<ResultadoIntento<T>> => {
    const requestId = response.headers.get(HEADER_REQUEST_ID) ?? undefined;
    if (modo === "bytes" && response.ok) {
      try {
        const binaria: RespuestaBinaria = {
          bytes: new Uint8Array(await response.arrayBuffer()),
          tipoContenido: response.headers.get("content-type") ?? "",
        };
        return { resultado: { success: true, data: binaria as T }, reintentable: false };
      } catch {
        return { resultado: mapearErrorRedTecnico(), reintentable: true };
      }
    }
    // Regla de `origen`: si el body no se pudo LEER (conexión cortada, timeout) es transporte;
    // si se leyó pero no es JSON o no tiene la forma esperada, es de la API.
    let cuerpoLeido: Awaited<ReturnType<typeof leerJson>>;
    try {
      cuerpoLeido = await leerJson(response);
    } catch {
      if (response.ok) {
        return { resultado: mapearErrorRedTecnico(), reintentable: true };
      }
      cuerpoLeido = null;
    }

    if (!response.ok) {
      const esperaSegundos = parsearRetryAfter(response.headers.get("Retry-After"));
      return {
        resultado: mapearErrorHttp(response, cuerpoLeido?.json),
        reintentable: esStatusReintentable(response.status),
        ...(response.status === 401 && { noAutorizado: true }),
        ...(esperaSegundos !== undefined && { esperaSugeridaMs: esperaSegundos * 1000 }),
      };
    }

    if (cuerpoLeido === null) {
      return {
        resultado: mapearErrorParseo("Respuesta no es JSON válido", requestId),
        reintentable: false,
      };
    }
    const datos = envelopeSoloData(cuerpoLeido.json) ? cuerpoLeido.json.data : cuerpoLeido.json;

    if (schemaRespuesta === undefined) {
      return { resultado: { success: true, data: datos as T }, reintentable: false };
    }
    const parseado = schemaRespuesta.safeParse(datos);
    if (!parseado.success) {
      return {
        resultado: mapearErrorParseo(`Shape inesperado: ${parseado.error.message}`, requestId),
        reintentable: false,
      };
    }
    return { resultado: { success: true, data: parseado.data }, reintentable: false };
  };

  const ejecutarIntento = async <T>({
    method,
    url,
    cuerpo,
    schemaRespuesta,
    opSignal,
    modo,
    timeoutMs,
  }: {
    method: string;
    url: URL;
    cuerpo: CuerpoPreparado;
    schemaRespuesta: ZodType<T> | undefined;
    opSignal: AbortSignal | undefined;
    modo: "json" | "bytes";
    timeoutMs: number;
  }): Promise<ResultadoIntento<T>> => {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signals = [timeoutSignal];
    if (clientSignal !== undefined) signals.push(clientSignal);
    if (opSignal !== undefined) signals.push(opSignal);

    let headers: Headers;
    try {
      headers = await construirHeaders(method, url, cuerpo);
    } catch (err) {
      return { resultado: mapearErrorAutenticacion(err), reintentable: false };
    }

    let response: Response;
    try {
      const init: RequestInit = {
        method,
        headers,
        redirect: "manual",
        signal: AbortSignal.any(signals),
      };
      if (cuerpo.contenido !== undefined) {
        init.body = cuerpo.contenido;
      }
      response = await fetchImpl(url.toString(), init);
    } catch (err) {
      if (clientSignal?.aborted === true || opSignal?.aborted === true) {
        return { resultado: mapearErrorAbortExterno(), reintentable: false };
      }
      if (timeoutSignal.aborted) {
        return { resultado: mapearErrorTimeout(), reintentable: true };
      }
      if (esErrorAbort(err)) {
        return { resultado: mapearErrorAbortExterno(), reintentable: false };
      }
      return { resultado: mapearErrorRedTecnico(), reintentable: true };
    }

    if (esRespuestaRedirect(response)) {
      return { resultado: mapearErrorRedirect(), reintentable: false };
    }

    const intento = await procesarRespuesta(response, schemaRespuesta, modo);
    return intento.noAutorizado === true ? { ...intento, headersEnviados: headers } : intento;
  };

  const request = async <T>(opts: OpcionesRequest<T>): Promise<Resultado<T>> => {
    const { method, path, body, query, schemaRespuesta, signal: opSignal, reintentar } = opts;
    const modo = opts.respuesta ?? "json";

    const timeoutMs = opts.timeout ?? timeout;
    if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return mapearErrorPeticion("timeout debe ser un número > 0 (ms)");
    }

    const url = construirUrl(baseUrl, path, query);
    if (url === null) {
      return mapearErrorPeticion("Ruta inválida");
    }
    const cuerpo = prepararCuerpo(body);
    if (cuerpo === null) {
      return mapearErrorPeticion("El cuerpo no es serializable a JSON");
    }

    const maximo = (reintentar ?? esMetodoIdempotente(method)) ? politica.maximo : 0;
    const signalsExternas = [clientSignal, opSignal].filter((s) => s !== undefined);
    const signalEspera = signalsExternas.length > 0 ? AbortSignal.any(signalsExternas) : undefined;

    let reintentoPor401 = false;
    for (let intento = 0; ; intento++) {
      const resultadoIntento = await ejecutarIntento({
        method,
        url,
        cuerpo,
        schemaRespuesta,
        opSignal,
        modo,
        timeoutMs,
      });
      if (
        resultadoIntento.noAutorizado === true &&
        autenticador.ante401 !== undefined &&
        !reintentoPor401
      ) {
        reintentoPor401 = true;
        try {
          autenticador.ante401(resultadoIntento.headersEnviados ?? new Headers());
        } catch {
          // No se pudo invalidar: reintentar saldría con el mismo token. Se devuelve el 401.
          return resultadoIntento.resultado;
        }
        intento--; // no consume el presupuesto de reintentos por red/5xx/429
        continue;
      }
      if (
        resultadoIntento.resultado.success ||
        !resultadoIntento.reintentable ||
        intento >= maximo
      ) {
        return resultadoIntento.resultado;
      }

      let espera: number;
      if (resultadoIntento.esperaSugeridaMs !== undefined) {
        // La API pide esperar más de lo tolerable: el consumidor decide con `retryAfter`.
        if (resultadoIntento.esperaSugeridaMs > politica.esperaMaximaMs) {
          return resultadoIntento.resultado;
        }
        espera = resultadoIntento.esperaSugeridaMs;
      } else {
        espera = calcularEsperaBackoff({
          intento,
          esperaBaseMs: politica.esperaBaseMs,
          esperaMaximaMs: politica.esperaMaximaMs,
          aleatorio,
        });
      }

      await dormir(espera, signalEspera);
      if (signalEspera?.aborted === true) {
        return mapearErrorAbortExterno();
      }
    }
  };

  return {
    request,
    get: <T>(path: string, options: OpcionesMetodo<T> = {}) =>
      request<T>({ ...options, method: "GET", path }),
    post: <T>(path: string, body: unknown, options: OpcionesMetodo<T> = {}) =>
      request<T>({ ...options, method: "POST", path, body }),
    put: <T>(path: string, body: unknown, options: OpcionesMetodo<T> = {}) =>
      request<T>({ ...options, method: "PUT", path, body }),
    patch: <T>(path: string, body: unknown, options: OpcionesMetodo<T> = {}) =>
      request<T>({ ...options, method: "PATCH", path, body }),
    delete: <T>(path: string, options: OpcionesMetodo<T> = {}) =>
      request<T>({ ...options, method: "DELETE", path }),
    /** GET que entrega el body crudo (`RespuestaBinaria`), p. ej. un PNG. */
    getBytes: (
      path: string,
      options: Omit<OpcionesMetodo<RespuestaBinaria>, "schemaRespuesta" | "respuesta"> = {},
    ) => request<RespuestaBinaria>({ ...options, method: "GET", path, respuesta: "bytes" }),
  };
};

export type HttpClient = ReturnType<typeof crearHttpClient>;
