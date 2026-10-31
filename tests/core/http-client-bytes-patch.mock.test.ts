import { describe, expect, it } from "vitest";
import { crearHttpDePrueba } from "../helpers/http-prueba.js";
import { BASE_URL_PRUEBA, respuestaError, respuestaJsonData } from "../helpers/mock-fetch.js";

describe("http client — getBytes", () => {
  it("entrega el body crudo y el content-type en un 2xx", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const { http, fetchMock } = crearHttpDePrueba(
      () => new Response(png, { status: 200, headers: { "content-type": "image/png" } }),
    );

    const r = await http.getBytes("/v1/session/qr", { query: { format: "png" } });

    expect(r).toEqual({ success: true, data: { bytes: png, tipoContenido: "image/png" } });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE_URL_PRUEBA}/v1/session/qr?format=png`);
  });

  it("un error HTTP se mapea como JSON aunque se pidan bytes", async () => {
    const { http } = crearHttpDePrueba(() => respuestaError(404, "Sesión no encontrada"));

    const r = await http.getBytes("/v1/session/qr");

    expect(r).toMatchObject({ success: false, codigo: 404, error: "Sesión no encontrada" });
  });
});

describe("http client — patch", () => {
  it("envía PATCH con body JSON", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({ ok: true }));

    const r = await http.patch("/v1/admin/x", { enabled: false });

    expect(r).toEqual({ success: true, data: { ok: true } });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe('{"enabled":false}');
  });
});

describe("http client — fallo al leer el body de un 2xx", () => {
  const cuerpoRoto = () =>
    new Response(
      new ReadableStream({
        start(controlador) {
          controlador.error(new Error("conexión cortada"));
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );

  it("en modo json es error de transporte (503), no de forma de la API", async () => {
    const { http } = crearHttpDePrueba(cuerpoRoto);

    const r = await http.get("/v1/me/schedule");

    expect(r).toMatchObject({ success: false, codigo: 503, origen: "transporte" });
  });

  it("en modo bytes es el mismo error de transporte", async () => {
    const { http } = crearHttpDePrueba(cuerpoRoto);

    const r = await http.getBytes("/v1/session/qr");

    expect(r).toMatchObject({ success: false, codigo: 503, origen: "transporte" });
  });

  it("un 2xx con texto no JSON sigue siendo error de la API (502)", async () => {
    const { http } = crearHttpDePrueba(() => new Response("<html>", { status: 200 }));

    const r = await http.get("/v1/me/schedule");

    expect(r).toMatchObject({ success: false, codigo: 502, origen: "api" });
  });
});
