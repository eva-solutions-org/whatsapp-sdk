import { describe, expect, it } from "vitest";
import { crearFacadeSesion } from "../../../src/features/sesion/index.js";
import { crearHttpDePrueba } from "../../helpers/http-prueba.js";
import { BASE_URL_PRUEBA, respuestaError, respuestaJsonData } from "../../helpers/mock-fetch.js";

const urlDe = (fetchMock: { mock: { calls: unknown[][] } }) =>
  fetchMock.mock.calls[0]?.[0] as string;
const initDe = (fetchMock: { mock: { calls: unknown[][] } }) =>
  fetchMock.mock.calls[0]?.[1] as RequestInit;

describe("sesion.obtenerQr", () => {
  it("sin formato no manda query y desenvuelve { qr }", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({ qr: "2@abc,def,ghi" }));

    const r = await crearFacadeSesion(http).obtenerQr();

    expect(r).toEqual({ success: true, data: { qr: "2@abc,def,ghi" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/session/qr`);
    expect(initDe(fetchMock).method).toBe("GET");
  });

  it("format=base64 viaja en el query", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() =>
      respuestaJsonData({ qr: "data:image/png;base64,iVBORw0KGgo=" }),
    );

    const r = await crearFacadeSesion(http).obtenerQr({ format: "base64" });

    expect(r).toEqual({ success: true, data: { qr: "data:image/png;base64,iVBORw0KGgo=" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/session/qr?format=base64`);
  });

  it("mapea el 409 cuando la sesión ya está conectada", async () => {
    const { http } = crearHttpDePrueba(() => respuestaError(409, "La sesión ya está conectada"));

    const r = await crearFacadeSesion(http).obtenerQr();

    expect(r).toMatchObject({ success: false, codigo: 409, error: "La sesión ya está conectada" });
  });

  it("mapea el 408 cuando el QR no llega a tiempo", async () => {
    const { http } = crearHttpDePrueba(() =>
      respuestaError(408, "Tiempo de espera para QR agotado"),
    );

    const r = await crearFacadeSesion(http).obtenerQr({ format: "raw" });

    expect(r).toMatchObject({ success: false, codigo: 408 });
  });

  it("rechaza format=png (va por obtenerQrPng) con 422 sin llamar a la red", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({ qr: "x" }));

    const r = await crearFacadeSesion(http).obtenerQr({ format: "png" as never });

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("sesion.obtenerQrPng", () => {
  it("pide format=png y entrega bytes y content-type", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const { http, fetchMock } = crearHttpDePrueba(
      () => new Response(png, { status: 200, headers: { "content-type": "image/png" } }),
    );

    const r = await crearFacadeSesion(http).obtenerQrPng();

    expect(r).toEqual({ success: true, data: { bytes: png, tipoContenido: "image/png" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/session/qr?format=png`);
  });

  it("mapea el 409 JSON aunque se haya pedido PNG", async () => {
    const { http } = crearHttpDePrueba(() => respuestaError(409, "La sesión ya está conectada"));

    const r = await crearFacadeSesion(http).obtenerQrPng();

    expect(r).toMatchObject({ success: false, codigo: 409, error: "La sesión ya está conectada" });
  });
});

describe("sesion: QR sin reintentos", () => {
  it.each([
    ["obtenerQr", (f: ReturnType<typeof crearFacadeSesion>) => f.obtenerQr()],
    ["obtenerQrPng", (f: ReturnType<typeof crearFacadeSesion>) => f.obtenerQrPng()],
  ])("%s no reintenta ante un 5xx (el GET dispara la sesión y espera el QR)", async (_n, op) => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaError(503, "caído"), {
      reintentos: { maximo: 2 },
    });

    const r = await op(crearFacadeSesion(http));

    expect(r).toMatchObject({ success: false, codigo: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
