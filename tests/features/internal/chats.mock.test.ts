import { describe, expect, it, vi } from "vitest";
import { crearClienteInterno } from "../../../src/internal.js";
import { TOKEN_SERVICIO_TEST } from "../../helpers/fixtures.js";
import {
  BASE_URL_PRUEBA,
  crearMockFetch,
  respuestaError,
  respuestaErrorToken,
  respuestaJsonData,
  respuestaValidacion422,
} from "../../helpers/mock-fetch.js";
import { crearInternoPrueba, esperarBearer, peticion } from "../../helpers/ayudas-token.js";

const PHONE = "51999999999";
const SOURCE = "51988888888";

describe("interno.chats.verificarExistencia", () => {
  it("GET /v1/internal/chats/{phone}/exists con sourcePhone en el query y Bearer", async () => {
    const { interno, fetchMock } = crearInternoPrueba(() => respuestaJsonData({ exists: true }));

    const r = await interno.chats.verificarExistencia({ phone: PHONE, sourcePhone: SOURCE });

    expect(r).toEqual({ success: true, data: { exists: true } });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("GET");
    expect(enviada.ruta).toBe(`/v1/internal/chats/${PHONE}/exists`);
    expect(enviada.query).toEqual({ sourcePhone: SOURCE });
    expect(enviada.cuerpo).toBeUndefined();
    esperarBearer(enviada.headers);
  });

  it("desenvuelve exists: false", async () => {
    const { interno } = crearInternoPrueba(() => respuestaJsonData({ exists: false }));

    const r = await interno.chats.verificarExistencia({ phone: PHONE, sourcePhone: SOURCE });

    expect(r).toEqual({ success: true, data: { exists: false } });
  });

  it.each([
    ["sin sourcePhone", { phone: PHONE }],
    ["phone corto", { phone: "123", sourcePhone: SOURCE }],
    ["sourcePhone largo", { phone: PHONE, sourcePhone: "1".repeat(21) }],
    ["campo extra", { phone: PHONE, sourcePhone: SOURCE, extra: 1 }],
  ])("rechaza %s con 422 local sin llamar a la red", async (_nombre, input) => {
    const { interno, fetchMock } = crearInternoPrueba(() => respuestaJsonData({ exists: true }));

    const r = await interno.chats.verificarExistencia(
      input as Parameters<typeof interno.chats.verificarExistencia>[0],
    );

    expect(r).toMatchObject({ success: false, codigo: 422, origen: "local" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("codifica el phone en el path (no se puede salir de la ruta)", async () => {
    const { interno, fetchMock } = crearInternoPrueba(() => respuestaJsonData({ exists: true }));

    await interno.chats.verificarExistencia({ phone: "5199/../admin", sourcePhone: SOURCE });

    expect(peticion(fetchMock).ruta).toBe("/v1/internal/chats/5199%2F..%2Fadmin/exists");
  });

  it("403 source_phone_not_allowed conserva codigoApi", async () => {
    const { interno } = crearInternoPrueba(() =>
      respuestaErrorToken(403, "source_phone_not_allowed", "sourcePhone no permitido"),
    );

    const r = await interno.chats.verificarExistencia({ phone: PHONE, sourcePhone: SOURCE });

    expect(r).toMatchObject({
      success: false,
      codigo: 403,
      origen: "api",
      codigoApi: "source_phone_not_allowed",
    });
  });

  it("429 conserva retryAfter y no se reintenta", async () => {
    const { interno, fetchMock } = crearInternoPrueba(() =>
      respuestaError(429, "Demasiadas consultas", { "Retry-After": "1800" }),
    );

    const r = await interno.chats.verificarExistencia({ phone: PHONE, sourcePhone: SOURCE });

    expect(r).toMatchObject({ success: false, codigo: 429, retryAfter: 1800 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ante un 401 invalida el token y reintenta una vez con el nuevo", async () => {
    const tokens = ["token-viejo", "token-nuevo"];
    const invalidarToken = vi.fn();
    let llamada = 0;
    const fetchMock = crearMockFetch(() =>
      (llamada += 1) === 1
        ? respuestaErrorToken(401, "invalid_token", "Token vencido")
        : respuestaJsonData({ exists: true }),
    );
    const interno = crearClienteInterno({
      baseUrl: BASE_URL_PRUEBA,
      obtenerToken: () => Promise.resolve(tokens.shift() as string),
      invalidarToken,
      fetch: fetchMock,
      reintentos: { maximo: 0 },
    });

    const r = await interno.chats.verificarExistencia({ phone: PHONE, sourcePhone: SOURCE });

    expect(r).toEqual({ success: true, data: { exists: true } });
    expect(invalidarToken).toHaveBeenCalledExactlyOnceWith("token-viejo");
    expect(peticion(fetchMock, 1).headers.get("authorization")).toBe("Bearer token-nuevo");
  });
});

describe("interno.chats.indicarEscritura", () => {
  it("POST /v1/internal/chats/{phone}/typing con sourcePhone, estado y segundos; sin phone en el body", async () => {
    const { interno, fetchMock } = crearInternoPrueba(() => respuestaJsonData({ message: "ok" }));

    const r = await interno.chats.indicarEscritura({
      phone: PHONE,
      sourcePhone: SOURCE,
      estado: "escribiendo",
      segundos: 3,
    });

    expect(r).toEqual({ success: true, data: { message: "ok" } });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("POST");
    expect(enviada.ruta).toBe(`/v1/internal/chats/${PHONE}/typing`);
    expect(enviada.cuerpo).toEqual({ sourcePhone: SOURCE, estado: "escribiendo", segundos: 3 });
    esperarBearer(enviada.headers);
    expect(JSON.stringify(enviada.cuerpo)).not.toContain(TOKEN_SERVICIO_TEST);
  });

  it.each([
    [
      "segundos sobre el tope",
      { phone: PHONE, sourcePhone: SOURCE, estado: "pausa", segundos: 26 },
    ],
    ["segundos cero", { phone: PHONE, sourcePhone: SOURCE, estado: "escribiendo", segundos: 0 }],
    ["estado desconocido", { phone: PHONE, sourcePhone: SOURCE, estado: "cantando" }],
    ["sin sourcePhone", { phone: PHONE, estado: "pausa" }],
  ])("rechaza %s con 422 local sin llamar a la red", async (_nombre, input) => {
    const { interno, fetchMock } = crearInternoPrueba(() => respuestaJsonData({ message: "ok" }));

    const r = await interno.chats.indicarEscritura(
      input as Parameters<typeof interno.chats.indicarEscritura>[0],
    );

    expect(r).toMatchObject({ success: false, codigo: 422, origen: "local" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mapea el 422 de la API", async () => {
    const { interno } = crearInternoPrueba(() => respuestaValidacion422({ segundos: ["Too big"] }));

    const r = await interno.chats.indicarEscritura({
      phone: PHONE,
      sourcePhone: SOURCE,
      estado: "pausa",
    });

    expect(r).toMatchObject({ success: false, codigo: 422, origen: "api" });
  });

  it("un 503 no se reintenta aunque el cliente permita reintentos", async () => {
    const fetchMock = crearMockFetch(() => respuestaError(503, "Sesión no disponible"));
    const interno = crearClienteInterno({
      baseUrl: BASE_URL_PRUEBA,
      obtenerToken: () => Promise.resolve(TOKEN_SERVICIO_TEST),
      fetch: fetchMock,
      reintentos: { maximo: 3, esperaBaseMs: 0, esperaMaximaMs: 0 },
    });

    const r = await interno.chats.indicarEscritura({
      phone: PHONE,
      sourcePhone: SOURCE,
      estado: "escribiendo",
    });

    expect(r).toMatchObject({ success: false, codigo: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ante un 401 reintenta el POST una vez con token nuevo", async () => {
    const tokens = ["token-viejo", "token-nuevo"];
    let llamada = 0;
    const fetchMock = crearMockFetch(() =>
      (llamada += 1) === 1
        ? respuestaErrorToken(401, "invalid_token", "Token vencido")
        : respuestaJsonData({ message: "ok" }),
    );
    const interno = crearClienteInterno({
      baseUrl: BASE_URL_PRUEBA,
      obtenerToken: () => Promise.resolve(tokens.shift() as string),
      invalidarToken: vi.fn(),
      fetch: fetchMock,
      reintentos: { maximo: 0 },
    });

    const r = await interno.chats.indicarEscritura({
      phone: PHONE,
      sourcePhone: SOURCE,
      estado: "grabando",
    });

    expect(r.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
