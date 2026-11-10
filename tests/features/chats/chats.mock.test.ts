import { describe, expect, it } from "vitest";
import { crearFacadeChats } from "../../../src/features/chats/index.js";
import { API_KEY_TEST } from "../../helpers/fixtures.js";
import { crearHttpDePrueba, headersDeLlamada } from "../../helpers/http-prueba.js";
import {
  BASE_URL_PRUEBA,
  respuestaError,
  respuestaJsonData,
  respuestaValidacion422,
} from "../../helpers/mock-fetch.js";

const PHONE = "593999999999";

const initDe = (fetchMock: { mock: { calls: unknown[][] } }, i = 0) =>
  fetchMock.mock.calls[i]?.[1] as RequestInit;
const urlDe = (fetchMock: { mock: { calls: unknown[][] } }, i = 0) =>
  fetchMock.mock.calls[i]?.[0] as string;

describe("chats.indicarEscritura", () => {
  it("hace POST a /v1/chats/{phone}/typing con estado y segundos, sin el phone en el body", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({ message: "ok" }));

    const r = await crearFacadeChats(http).indicarEscritura({
      phone: PHONE,
      estado: "escribiendo",
      segundos: 3,
    });

    expect(r).toEqual({ success: true, data: { message: "ok" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/chats/${PHONE}/typing`);
    expect(initDe(fetchMock).method).toBe("POST");
    expect(initDe(fetchMock).body).toBe(JSON.stringify({ estado: "escribiendo", segundos: 3 }));
    expect(headersDeLlamada(fetchMock).get("x-api-key")).toBe(API_KEY_TEST);
  });

  it.each([
    ["segundos sobre el tope", { phone: PHONE, estado: "escribiendo", segundos: 26 }],
    ["segundos cero", { phone: PHONE, estado: "escribiendo", segundos: 0 }],
    ["estado desconocido", { phone: PHONE, estado: "cantando" }],
    ["teléfono con +", { phone: `+${PHONE}`, estado: "pausa" }],
  ])("rechaza %s con 422 sin llamar a la red", async (_nombre, input) => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({ message: "ok" }));

    const r = await crearFacadeChats(http).indicarEscritura(
      input as Parameters<ReturnType<typeof crearFacadeChats>["indicarEscritura"]>[0],
    );

    expect(r).toMatchObject({ success: false, codigo: 422, origen: "local" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mapea el 422 de la API", async () => {
    const { http } = crearHttpDePrueba(() => respuestaValidacion422({ segundos: ["Too big"] }));

    const r = await crearFacadeChats(http).indicarEscritura({ phone: PHONE, estado: "pausa" });

    expect(r).toMatchObject({
      success: false,
      codigo: 422,
      origen: "api",
      detalles: { fieldErrors: { segundos: ["Too big"] } },
    });
  });
});

describe("chats.verificarExistencia", () => {
  it("hace GET a /v1/chats/{phone}/exists y desenvuelve { exists }", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({ exists: true }));

    const r = await crearFacadeChats(http).verificarExistencia({ phone: PHONE });

    expect(r).toEqual({ success: true, data: { exists: true } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/chats/${PHONE}/exists`);
    expect(initDe(fetchMock).method).toBe("GET");
  });

  it("devuelve exists false tal cual", async () => {
    const { http } = crearHttpDePrueba(() => respuestaJsonData({ exists: false }));

    const r = await crearFacadeChats(http).verificarExistencia({ phone: PHONE });

    expect(r).toEqual({ success: true, data: { exists: false } });
  });

  it("mapea el 429 con retryAfter", async () => {
    const { http } = crearHttpDePrueba(() =>
      respuestaError(429, "Demasiadas consultas", { "Retry-After": "1800" }),
    );

    const r = await crearFacadeChats(http).verificarExistencia({ phone: PHONE });

    expect(r).toMatchObject({ success: false, codigo: 429, retryAfter: 1800 });
  });

  it("responde 502 si el cuerpo no trae exists booleano", async () => {
    const { http } = crearHttpDePrueba(() => respuestaJsonData({ exists: "si" }));

    const r = await crearFacadeChats(http).verificarExistencia({ phone: PHONE });

    expect(r).toMatchObject({ success: false, codigo: 502, origen: "api" });
  });
});

describe("chats.marcarLeido", () => {
  it("hace POST a /v1/chats/{phone}/read con messageIds", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({ message: "leído" }));

    const r = await crearFacadeChats(http).marcarLeido({ phone: PHONE, messageIds: ["A1", "B2"] });

    expect(r).toEqual({ success: true, data: { message: "leído" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/chats/${PHONE}/read`);
    expect(initDe(fetchMock).body).toBe(JSON.stringify({ messageIds: ["A1", "B2"] }));
  });

  it.each([
    ["lista vacía", []],
    ["más de 50 ids", Array.from({ length: 51 }, (_, i) => `id${String(i)}`)],
    ["id vacío", [""]],
  ])("rechaza %s con 422 sin llamar a la red", async (_nombre, messageIds) => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({ message: "x" }));

    const r = await crearFacadeChats(http).marcarLeido({ phone: PHONE, messageIds });

    expect(r).toMatchObject({ success: false, codigo: 422, origen: "local" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("chats.cambiarPresencia", () => {
  it("hace POST a /v1/presence con el estado", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({ message: "ok" }));

    const r = await crearFacadeChats(http).cambiarPresencia({ estado: "en_linea" });

    expect(r).toEqual({ success: true, data: { message: "ok" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/presence`);
    expect(initDe(fetchMock).body).toBe(JSON.stringify({ estado: "en_linea" }));
  });

  it("mapea el 503 de sesión no disponible", async () => {
    const { http } = crearHttpDePrueba(() =>
      respuestaError(503, "Sesión de WhatsApp no disponible"),
    );

    const r = await crearFacadeChats(http).cambiarPresencia({ estado: "desconectado" });

    expect(r).toMatchObject({ success: false, codigo: 503 });
  });
});
