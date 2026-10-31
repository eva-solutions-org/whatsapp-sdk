import { describe, expect, it } from "vitest";
import { crearCliente, crearHttpClientS2S } from "../../src/core/cliente/index.js";
import { ErrorConfiguracion } from "../../src/core/errors/index.js";
import { API_KEY_TEST, CLIENT_ID_S2S_TEST, SECRETO_S2S_HEX_TEST } from "../helpers/fixtures.js";
import { BASE_URL_PRUEBA, crearMockFetch, respuestaJsonData } from "../helpers/mock-fetch.js";

const base = { baseUrl: BASE_URL_PRUEBA };

describe("crearCliente", () => {
  it("expone un namespace por feature de la superficie x-api-key", () => {
    const cliente = crearCliente({ ...base, apiKey: API_KEY_TEST });

    expect(Object.keys(cliente).sort()).toEqual([
      "billing",
      "bufferWs",
      "mensajes",
      "programados",
      "seguridad",
      "sesion",
      "webhookSecret",
      "webhooksFallidos",
    ]);
  });

  it.each([
    ["apiKey vacía", { ...base, apiKey: "" }, "apiKey"],
    ["apiKey no string", { ...base, apiKey: 123 as unknown as string }, "apiKey"],
    ["baseUrl inválida", { baseUrl: "http://remoto.example.com", apiKey: API_KEY_TEST }, "baseUrl"],
    ["timeout cero", { ...base, apiKey: API_KEY_TEST, timeout: 0 }, "timeout"],
    ["timeout NaN", { ...base, apiKey: API_KEY_TEST, timeout: Number.NaN }, "timeout"],
    [
      "reintentos.maximo fraccional",
      { ...base, apiKey: API_KEY_TEST, reintentos: { maximo: 1.5 } },
      "reintentos.maximo",
    ],
    [
      "reintentos.maximo sobre el tope",
      { ...base, apiKey: API_KEY_TEST, reintentos: { maximo: 11 } },
      "reintentos.maximo",
    ],
    [
      "reintentos.esperaBaseMs negativa",
      { ...base, apiKey: API_KEY_TEST, reintentos: { esperaBaseMs: -1 } },
      "reintentos.esperaBaseMs",
    ],
  ])("lanza ErrorConfiguracion por %s", (_caso, opciones, fragmento) => {
    let error: unknown;
    try {
      crearCliente(opciones);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(ErrorConfiguracion);
    expect((error as Error).message).toContain(fragmento);
  });

  it("nunca incluye la apiKey en el mensaje de un error de configuración", () => {
    let error: unknown;
    try {
      crearCliente({ baseUrl: "http://remoto.example.com", apiKey: API_KEY_TEST });
    } catch (e) {
      error = e;
    }

    expect((error as Error).message).not.toContain(API_KEY_TEST);
  });

  it("lanza ErrorConfiguracion si las opciones son null", () => {
    expect(() => crearCliente(null as never)).toThrow(ErrorConfiguracion);
  });
});

describe("crearHttpClientS2S", () => {
  it("firma las requests con los 4 headers x-eva-*", async () => {
    const fetchMock = crearMockFetch(() => respuestaJsonData({ ok: true }));
    const http = crearHttpClientS2S({
      ...base,
      clientId: CLIENT_ID_S2S_TEST,
      secretoHex: SECRETO_S2S_HEX_TEST,
      fetch: fetchMock,
    });

    const r = await http.get("/v1/admin/x");

    expect(r).toEqual({ success: true, data: { ok: true } });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("x-eva-client-id")).toBe(CLIENT_ID_S2S_TEST);
    expect(headers.get("x-eva-timestamp")).toMatch(/^\d{10}$/);
    expect(headers.get("x-eva-nonce")).toMatch(/^[0-9a-f]{32}$/);
    expect(headers.get("x-eva-signature")).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it.each([
    ["secretoHex no hex", { clientId: CLIENT_ID_S2S_TEST, secretoHex: "no-es-hex" }, "secretoHex"],
    ["secretoHex impar", { clientId: CLIENT_ID_S2S_TEST, secretoHex: "abc" }, "secretoHex"],
    ["clientId vacío", { clientId: "", secretoHex: SECRETO_S2S_HEX_TEST }, "clientId"],
  ])("lanza ErrorConfiguracion sin filtrar el secreto: %s", (_caso, credenciales, fragmento) => {
    let error: unknown;
    try {
      crearHttpClientS2S({ ...base, ...credenciales });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(ErrorConfiguracion);
    expect((error as Error).message).toContain(fragmento);
    expect((error as Error).message).not.toContain(credenciales.secretoHex);
  });
});
