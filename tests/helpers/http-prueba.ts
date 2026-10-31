import { crearHttpClient } from "../../src/core/http-client/index.js";
import type {
  Autenticador,
  HttpClient,
  OpcionesHttpClient,
} from "../../src/core/http-client/index.js";
import { autenticadorApiKey } from "../../src/core/http-client/index.js";
import { API_KEY_TEST } from "./fixtures.js";
import { BASE_URL_PRUEBA, crearMockFetch } from "./mock-fetch.js";
import type { MockFetchHandler } from "./mock-fetch.js";

/**
 * Arma un `HttpClient` real contra un `fetch` mockeado, para probar un feature de punta a
 * punta (path, query, headers, body y mapeo de la respuesta) sin pasar por `crearCliente`.
 *
 * Por defecto: autenticador `x-api-key`, SIN reintentos (los tests de un feature no deben
 * depender de backoff) y espera instantánea. Pasa `opciones` para sobreescribir.
 *
 * ```ts
 * const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({ id: "1" }));
 * const r = await crearFacadeMensajes(http).enviarTexto({ ... });
 * expect(fetchMock).toHaveBeenCalledWith("http://localhost:6000/v1/...", expect.anything());
 * ```
 */
export const crearHttpDePrueba = (
  handler: MockFetchHandler,
  opciones: Partial<Omit<OpcionesHttpClient, "fetchImpl" | "baseUrl">> & {
    autenticador?: Autenticador;
  } = {},
): { http: HttpClient; fetchMock: ReturnType<typeof crearMockFetch> } => {
  const fetchMock = crearMockFetch(handler);
  const http = crearHttpClient({
    baseUrl: BASE_URL_PRUEBA,
    autenticador: autenticadorApiKey(API_KEY_TEST),
    timeout: 5_000,
    reintentos: { maximo: 0 },
    dormir: () => Promise.resolve(),
    ...opciones,
    fetchImpl: fetchMock,
  });
  return { http, fetchMock };
};

/** Headers enviados en la llamada `indice` (0 por defecto) de un `fetchMock`. */
export const headersDeLlamada = (
  fetchMock: ReturnType<typeof crearMockFetch>,
  indice = 0,
): Headers => {
  const [, init] = fetchMock.mock.calls[indice] as [string, RequestInit];
  return new Headers(init.headers);
};
