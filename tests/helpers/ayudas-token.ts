import { expect } from "vitest";
import { crearClienteAdmin } from "../../src/admin.js";
import { crearClienteInterno } from "../../src/internal.js";
import { TOKEN_SERVICIO_TEST } from "./fixtures.js";
import { BASE_URL_PRUEBA, crearMockFetch } from "./mock-fetch.js";
import type { MockFetchHandler } from "./mock-fetch.js";

/**
 * Ayudas de los tests de `./admin` e `./internal`: arman el cliente PÚBLICO (con Bearer
 * real) contra un `fetch` mockeado, sin reintentos, y leen lo que realmente se envió.
 */

const opcionesPrueba = (fetchMock: ReturnType<typeof crearMockFetch>) => ({
  baseUrl: BASE_URL_PRUEBA,
  obtenerToken: () => Promise.resolve(TOKEN_SERVICIO_TEST),
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

/** El header `Authorization: Bearer <token>` con el token de servicio de las pruebas. */
export const esperarBearer = (headers: Headers): void => {
  expect(headers.get("authorization")).toBe(`Bearer ${TOKEN_SERVICIO_TEST}`);
};
