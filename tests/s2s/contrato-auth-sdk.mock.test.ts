import {
  buildS2SCanonicalString,
  signS2SHeaders,
  signS2SRequest,
  verifyS2SRequest,
} from "@eva_solutions/auth-sdk/s2s";
import { afterEach, describe, expect, it, vi } from "vitest";
import { crearHttpClientS2S } from "../../src/core/cliente/index.js";
import {
  construirCadenaCanonicaS2S,
  firmarHeadersS2S,
  firmarS2S,
} from "../../src/core/s2s/index.js";
import type { PartesCanonicasS2S } from "../../src/core/s2s/index.js";
import { CLIENT_ID_S2S_TEST, SECRETO_S2S_HEX_TEST } from "../helpers/fixtures.js";
import { BASE_URL_PRUEBA, crearMockFetch, respuestaJsonData } from "../helpers/mock-fetch.js";

/**
 * Test de contrato: la firma S2S del SDK debe ser idéntica a la del auth-sdk (dueño del
 * algoritmo y verificador que usa la API). Si el auth-sdk cambia el contrato, esto falla.
 */

const codificador = new TextEncoder();
const NONCE_FIJO = "00112233445566778899aabbccddeeff";
const TIMESTAMP_FIJO = "1767000000";

const base = {
  timestamp: TIMESTAMP_FIJO,
  nonce: NONCE_FIJO,
  clientId: CLIENT_ID_S2S_TEST,
};

const CASOS: Array<[string, PartesCanonicasS2S]> = [
  [
    "GET sin query ni body",
    { ...base, method: "GET", path: "/v1/admin/ping", rawQuery: "", cuerpo: new Uint8Array(0) },
  ],
  [
    "POST con body JSON y query",
    {
      ...base,
      method: "POST",
      path: "/v1/internal/send",
      rawQuery: "a=1&b=x%20y",
      cuerpo: codificador.encode('{"a":1}'),
    },
  ],
  [
    "query desordenado con caracteres especiales",
    {
      ...base,
      method: "GET",
      path: "/v1/admin/service-clients",
      rawQuery: "z=%C3%B1&A=!x&a=b+c&a=a&flag",
      cuerpo: new Uint8Array(0),
    },
  ],
  [
    "método en minúsculas y body con UTF-8",
    {
      ...base,
      method: "delete",
      path: "/v1/admin/x/ñ",
      rawQuery: "",
      cuerpo: codificador.encode('{"nombre":"Ángel"}'),
    },
  ],
];

const aPartesAuthSdk = ({ cuerpo, ...resto }: PartesCanonicasS2S) => ({
  ...resto,
  bodyBytes: cuerpo,
});

describe("firma S2S == auth-sdk", () => {
  it.each(CASOS)("canonical string idéntico: %s", async (_caso, partes) => {
    const esperado = await buildS2SCanonicalString(aPartesAuthSdk(partes));

    const obtenido = await construirCadenaCanonicaS2S(partes);

    expect(obtenido).toBe(esperado);
    expect(obtenido.split("\n")).toHaveLength(7);
  });

  it.each(CASOS)("firma idéntica: %s", async (_caso, partes) => {
    const esperada = await signS2SRequest({
      parts: aPartesAuthSdk(partes),
      secretHex: SECRETO_S2S_HEX_TEST,
    });

    const obtenida = await firmarS2S({ partes, secretoHex: SECRETO_S2S_HEX_TEST });

    expect(obtenida).toBe(esperada);
    expect(obtenida).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it("coincide con el vector literal calculado de forma independiente con node:crypto", async () => {
    const partes = CASOS[1]?.[1] as PartesCanonicasS2S;

    const cadena = await construirCadenaCanonicaS2S(partes);
    const firma = await firmarS2S({ partes, secretoHex: SECRETO_S2S_HEX_TEST });

    expect(cadena).toBe(
      "POST\n/v1/internal/send\na=1&b=x%20y\n1767000000\n00112233445566778899aabbccddeeff\nservicio-prueba\n015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862",
    );
    expect(firma).toBe("sha256=d333ffb53ba60f0af9b628501471aee28956fe90804b238d057e25b319717ab4");
  });

  it("rechaza un nonce no canónico (mayúsculas) como el auth-sdk", async () => {
    const partes = { ...(CASOS[0]?.[1] as PartesCanonicasS2S), nonce: NONCE_FIJO.toUpperCase() };

    await expect(firmarS2S({ partes, secretoHex: SECRETO_S2S_HEX_TEST })).rejects.toThrow(/nonce/);
    await expect(
      signS2SRequest({ parts: aPartesAuthSdk(partes), secretHex: SECRETO_S2S_HEX_TEST }),
    ).rejects.toThrow(/nonce/);
  });
});

describe("headers S2S", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("firmarHeadersS2S produce los mismos 4 headers que signS2SHeaders con timestamp y nonce fijos", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Number(TIMESTAMP_FIJO) * 1000));
    vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation(((arreglo: Uint8Array) => {
      arreglo.set(Uint8Array.from({ length: arreglo.length }, (_, i) => i * 0x11));
      return arreglo;
    }) as typeof globalThis.crypto.getRandomValues);
    const entrada = {
      method: "POST",
      path: "/v1/internal/send",
      rawQuery: "a=1",
      clientId: CLIENT_ID_S2S_TEST,
    };
    const cuerpo = codificador.encode('{"x":true}');

    const esperados = await signS2SHeaders({
      ...entrada,
      bodyBytes: cuerpo,
      secretHex: SECRETO_S2S_HEX_TEST,
    });
    const obtenidos = await firmarHeadersS2S({
      ...entrada,
      cuerpo,
      secretoHex: SECRETO_S2S_HEX_TEST,
    });

    expect(obtenidos).toEqual(esperados);
    expect(obtenidos["x-eva-nonce"]).toBe(NONCE_FIJO);
    expect(obtenidos["x-eva-timestamp"]).toBe(TIMESTAMP_FIJO);
  });

  it("genera un nonce distinto en cada llamada", async () => {
    const entrada = {
      method: "GET",
      path: "/v1/admin/ping",
      clientId: CLIENT_ID_S2S_TEST,
      secretoHex: SECRETO_S2S_HEX_TEST,
    };

    const a = await firmarHeadersS2S(entrada);
    const b = await firmarHeadersS2S(entrada);

    expect(a["x-eva-nonce"]).not.toBe(b["x-eva-nonce"]);
  });
});

describe("request firmada por el http client verificada por el auth-sdk", () => {
  const secretStore = async (clientId: string) =>
    clientId === CLIENT_ID_S2S_TEST ? SECRETO_S2S_HEX_TEST : null;

  const enviarYCapturar = async (
    ejecutar: (http: ReturnType<typeof crearHttpClientS2S>) => Promise<unknown>,
  ): Promise<{ url: string; init: RequestInit }> => {
    const fetchMock = crearMockFetch(() => respuestaJsonData({ ok: true }));
    const http = crearHttpClientS2S({
      baseUrl: BASE_URL_PRUEBA,
      clientId: CLIENT_ID_S2S_TEST,
      secretoHex: SECRETO_S2S_HEX_TEST,
      fetch: fetchMock,
    });
    await ejecutar(http);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return { url, init };
  };

  it("verifyS2SRequest acepta un POST con body y query", async () => {
    const { url, init } = await enviarYCapturar((http) =>
      http.post(
        "/v1/internal/send",
        { to: "593999999999", text: "hola ñ" },
        {
          query: { b: "x y", a: 1 },
        },
      ),
    );

    const resultado = await verifyS2SRequest(new Request(url, init), { secretStore });

    expect(resultado).toEqual({ ok: true, data: { clientId: CLIENT_ID_S2S_TEST } });
  });

  it("verifyS2SRequest acepta un GET sin body", async () => {
    const { url, init } = await enviarYCapturar((http) => http.get("/v1/admin/service-clients"));

    const resultado = await verifyS2SRequest(new Request(url, init), { secretStore });

    expect(resultado).toEqual({ ok: true, data: { clientId: CLIENT_ID_S2S_TEST } });
  });

  it("verifyS2SRequest rechaza la request si se altera el body después de firmar", async () => {
    const { url, init } = await enviarYCapturar((http) =>
      http.post("/v1/internal/send", { to: "593999999999", text: "hola" }),
    );

    const resultado = await verifyS2SRequest(
      new Request(url, { ...init, body: '{"to":"593999999999","text":"HOLA"}' }),
      { secretStore },
    );

    expect(resultado.ok).toBe(false);
    expect(resultado.ok === false && resultado.error.reason).toBe("signature_invalid");
  });
});
