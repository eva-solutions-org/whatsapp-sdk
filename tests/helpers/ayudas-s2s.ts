import { expect } from "vitest";
import { crearClienteAdmin } from "../../src/admin.js";
import { crearClienteInterno } from "../../src/internal.js";
import { CLIENT_ID_S2S_TEST, SECRETO_S2S_HEX_TEST } from "./fixtures.js";
import { BASE_URL_PRUEBA, crearMockFetch } from "./mock-fetch.js";
import type { MockFetchHandler } from "./mock-fetch.js";

/**
 * Ayudas de los tests de `./admin` e `./internal`: arman el cliente PÚBLICO (con firma S2S
 * real) contra un `fetch` mockeado, sin reintentos, y leen lo que realmente se envió.
 */

const opcionesPrueba = (fetchMock: ReturnType<typeof crearMockFetch>) => ({
  baseUrl: BASE_URL_PRUEBA,
  clientId: CLIENT_ID_S2S_TEST,
  secretoHex: SECRETO_S2S_HEX_TEST,
  fetch: fetchMock,
  timeout: 5_000,
  reintentos: { maximo: 0 },
});

export const crearAdminPrueba = (handler: MockFetchHandler) => {
  const fetchMock = crearMockFetch(handler);
  return { admin: crearClienteAdmin(opcionesPrueba(fetchMock)), fetchMock };
};

export const crearInternoPrueba = (handler: MockFetchHandler) => {
  const fetchMock = crearMockFetch(handler);
  return { interno: crearClienteInterno(opcionesPrueba(fetchMock)), fetchMock };
};

export interface PeticionEnviada {
  metodo: string | undefined;
  ruta: string;
  query: Record<string, string>;
  /** Body JSON parseado; `undefined` si la request no llevó body. */
  cuerpo: unknown;
  headers: Headers;
}

/** Lo enviado en la llamada `indice` (0 por defecto) del `fetchMock`. */
export const peticion = (
  fetchMock: ReturnType<typeof crearMockFetch>,
  indice = 0,
): PeticionEnviada => {
  const [url, init] = fetchMock.mock.calls[indice] as [string, RequestInit];
  const destino = new URL(url);
  return {
    metodo: init.method,
    ruta: destino.pathname,
    query: Object.fromEntries(destino.searchParams),
    cuerpo: typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : undefined,
    headers: new Headers(init.headers),
  };
};

/** Los cuatro headers `X-Eva-*` de la firma S2S, con el formato que exige la API. */
export const esperarHeadersS2S = (headers: Headers): void => {
  expect(headers.get("x-eva-client-id")).toBe(CLIENT_ID_S2S_TEST);
  expect(headers.get("x-eva-timestamp")).toMatch(/^\d{10}$/);
  expect(headers.get("x-eva-nonce")).toMatch(/^[0-9a-f]{32}$/);
  expect(headers.get("x-eva-signature")).toMatch(/^sha256=[0-9a-f]{64}$/);
};
