import { vi } from "vitest";

/**
 * Helpers de `fetch` mockeado para los tests `*.mock.test.ts` (sin red).
 *
 * El handler recibe `(url, init)` y retorna la `Response` deseada. El mock devuelto es un
 * `vi.fn`, así que se pueden inspeccionar `mock.calls` (URL, headers, body, signal).
 */

/** Origin de pruebas pasado como `baseUrl` (loopback http permitido por la validación). */
export const BASE_URL_PRUEBA = "http://localhost:6000";

export interface MockFetchHandler {
  (url: string, init: RequestInit): Promise<Response> | Response;
}

export const crearMockFetch = (handler: MockFetchHandler) =>
  vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();
    return handler(urlStr, init ?? {});
  }) as unknown as typeof globalThis.fetch & ReturnType<typeof vi.fn>;

interface InitRespuesta {
  status?: number;
  headers?: Record<string, string>;
}

/** `Response` JSON con status configurable. */
export const respuestaJson = (body: unknown, init: InitRespuesta = {}): Response => {
  const headers = new Headers(init.headers);
  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
};

/** `Response` con el envelope `{ data }` de la API. */
export const respuestaJsonData = (data: unknown, init: InitRespuesta = {}): Response =>
  respuestaJson({ data }, init);

/** Error de app de la API: `{ error: "<mensaje>" }` (`app.onError`, rate limit, 404...). */
export const respuestaError = (
  status: number,
  mensaje: string,
  headers: Record<string, string> = {},
): Response => respuestaJson({ error: mensaje }, { status, headers });

/** 422 de validación (`defaultHookValidacion422`): `{ error: "Body inválido", detalles }`. */
export const respuestaValidacion422 = (
  fieldErrors: Record<string, string[]>,
  headers: Record<string, string> = {},
): Response =>
  respuestaJson(
    { error: "Body inválido", detalles: { formErrors: [], fieldErrors } },
    { status: 422, headers },
  );

/** 401 S2S uniforme del s2s-error-mapper: `{ error: { code, message } }`. */
export const respuestaErrorToken = (
  status = 401,
  code = "unauthorized",
  message = "Acceso no autorizado",
): Response => respuestaJson({ error: { code, message } }, { status });

/** `Response` 204 sin cuerpo. */
export const respuestaSinContenido = (): Response => new Response(null, { status: 204 });
