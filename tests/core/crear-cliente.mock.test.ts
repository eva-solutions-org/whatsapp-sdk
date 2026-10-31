import { describe, expect, it, vi } from "vitest";
import { crearCliente, crearHttpClientConToken } from "../../src/core/cliente/index.js";
import { ErrorConfiguracion } from "../../src/core/errors/index.js";
import { API_KEY_TEST, TOKEN_SERVICIO_TEST } from "../helpers/fixtures.js";
import {
  BASE_URL_PRUEBA,
  crearMockFetch,
  respuestaErrorToken,
  respuestaJsonData,
} from "../helpers/mock-fetch.js";

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

describe("crearHttpClientConToken", () => {
  const crear = (opciones: Record<string, unknown> = {}) => {
    const fetchMock = crearMockFetch(() => respuestaJsonData({ ok: true }));
    const http = crearHttpClientConToken({
      ...base,
      obtenerToken: () => Promise.resolve(TOKEN_SERVICIO_TEST),
      fetch: fetchMock,
      ...opciones,
    });
    return { http, fetchMock };
  };
  const headersDe = (fetchMock: ReturnType<typeof crearMockFetch>, i = 0): Headers =>
    new Headers((fetchMock.mock.calls[i] as [string, RequestInit])[1].headers);

  it("envía Authorization: Bearer con el token y ningún header x-eva-*", async () => {
    const { http, fetchMock } = crear();

    const r = await http.get("/v1/admin/x");

    expect(r).toEqual({ success: true, data: { ok: true } });
    const headers = headersDe(fetchMock);
    expect(headers.get("authorization")).toBe(`Bearer ${TOKEN_SERVICIO_TEST}`);
    expect([...headers.keys()].filter((k) => k.startsWith("x-eva-"))).toEqual([]);
  });

  it("pide el token en cada request (un token renovado se usa en la siguiente)", async () => {
    const tokens = ["t1", "t2"];
    const { http, fetchMock } = crear({
      obtenerToken: () => Promise.resolve(tokens.shift() as string),
    });

    await http.get("/v1/a");
    await http.get("/v1/b");

    expect([
      headersDe(fetchMock, 0).get("authorization"),
      headersDe(fetchMock, 1).get("authorization"),
    ]).toEqual(["Bearer t1", "Bearer t2"]);
  });

  it("ante 401 llama invalidarToken una vez y reintenta con el token nuevo", async () => {
    const tokens = ["viejo", "nuevo"];
    const invalidarToken = vi.fn();
    let llamada = 0;
    const fetchMock = crearMockFetch(() =>
      (llamada += 1) === 1 ? respuestaErrorToken() : respuestaJsonData({ ok: true }),
    );
    const http = crearHttpClientConToken({
      ...base,
      obtenerToken: () => Promise.resolve(tokens.shift() as string),
      invalidarToken,
      fetch: fetchMock,
    });

    const r = await http.post("/v1/x", {});

    expect(r).toEqual({ success: true, data: { ok: true } });
    expect(invalidarToken).toHaveBeenCalledTimes(1);
    expect([
      headersDe(fetchMock, 0).get("authorization"),
      headersDe(fetchMock, 1).get("authorization"),
    ]).toEqual(["Bearer viejo", "Bearer nuevo"]);
  });

  it("pasa a invalidarToken el token que recibió el 401", async () => {
    const tokens = ["viejo", "nuevo"];
    const invalidarToken = vi.fn();
    let llamada = 0;
    const fetchMock = crearMockFetch(() =>
      (llamada += 1) === 1 ? respuestaErrorToken() : respuestaJsonData({ ok: true }),
    );
    const http = crearHttpClientConToken({
      ...base,
      obtenerToken: () => Promise.resolve(tokens.shift() as string),
      invalidarToken,
      fetch: fetchMock,
    });

    await http.get("/v1/x");

    expect(invalidarToken).toHaveBeenCalledExactlyOnceWith("viejo");
  });

  it("sin invalidarToken el 401 NO se reintenta (saldría con el mismo token)", async () => {
    const fetchMock = crearMockFetch(() => respuestaErrorToken());
    const http = crearHttpClientConToken({
      ...base,
      obtenerToken: () => Promise.resolve(TOKEN_SERVICIO_TEST),
      fetch: fetchMock,
    });

    const r = await http.post("/v1/x", {});

    expect(r).toMatchObject({ success: false, codigo: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("si invalidarToken lanza devuelve el 401 como Resultado, sin excepción ni reintento", async () => {
    const fetchMock = crearMockFetch(() => respuestaErrorToken());
    const http = crearHttpClientConToken({
      ...base,
      obtenerToken: () => Promise.resolve(TOKEN_SERVICIO_TEST),
      invalidarToken: () => {
        throw new Error("fallo-al-invalidar");
      },
      fetch: fetchMock,
    });

    const r = await http.post("/v1/x", {});

    expect(r).toMatchObject({ success: false, codigo: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("si obtenerToken falla en el reintento tras el 401 devuelve 500 local, sin excepción", async () => {
    let pedidos = 0;
    const fetchMock = crearMockFetch(() => respuestaErrorToken());
    const http = crearHttpClientConToken({
      ...base,
      obtenerToken: () =>
        (pedidos += 1) === 1 ? Promise.resolve("viejo") : Promise.reject(new Error("auth caído")),
      invalidarToken: vi.fn(),
      fetch: fetchMock,
    });

    const r = await http.get("/v1/x");

    expect(r).toMatchObject({ success: false, codigo: 500, origen: "local" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("expone en detalles un code OAuth no sensible del error de obtenerToken", async () => {
    const { http } = crear({
      obtenerToken: () =>
        Promise.reject(
          Object.assign(new Error("secreto-en-el-mensaje"), { code: "invalid_client" }),
        ),
    });

    const r = await http.get("/v1/x");

    expect(r).toEqual({
      success: false,
      codigo: 500,
      origen: "local",
      error: "No se pudo autenticar la petición",
      detalles: { code: "invalid_client" },
    });
  });

  it.each([
    ["código de red", { code: "ECONNREFUSED" }],
    ["code libre con datos", { code: "client abc secret=123" }],
    ["code no string", { code: 42 }],
    ["sin code", {}],
  ])("no expone detalles si el error trae %s", async (_caso, extra) => {
    const { http } = crear({
      obtenerToken: () => Promise.reject(Object.assign(new Error("m"), extra)),
    });

    const r = await http.get("/v1/x");

    expect(r).toMatchObject({ success: false, codigo: 500, origen: "local" });
    expect(r).not.toHaveProperty("detalles");
  });

  it("si obtenerToken falla responde 500 local sin llamar a fetch ni filtrar el motivo", async () => {
    const { http, fetchMock } = crear({
      obtenerToken: () => Promise.reject(new Error("motivo-que-no-debe-filtrarse")),
    });

    const r = await http.get("/v1/x");

    expect(r).toMatchObject({ success: false, codigo: 500, origen: "local" });
    expect(JSON.stringify(r)).not.toContain("motivo-que-no-debe-filtrarse");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["vacío", ""],
    ["no string", 42],
  ])("un token %s se trata como fallo de autenticación local", async (_caso, token) => {
    const { http, fetchMock } = crear({ obtenerToken: () => Promise.resolve(token) });

    const r = await http.get("/v1/x");

    expect(r).toMatchObject({ success: false, codigo: 500, origen: "local" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["obtenerToken ausente", { obtenerToken: undefined }, "obtenerToken"],
    ["obtenerToken no función", { obtenerToken: "abc" }, "obtenerToken"],
    ["invalidarToken no función", { invalidarToken: "abc" }, "invalidarToken"],
  ])("lanza ErrorConfiguracion: %s", (_caso, extra, fragmento) => {
    let error: unknown;
    try {
      crear(extra);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(ErrorConfiguracion);
    expect((error as Error).message).toContain(fragmento);
  });
});
