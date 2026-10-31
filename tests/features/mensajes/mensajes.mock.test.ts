import { describe, expect, it } from "vitest";
import { crearFacadeMensajes } from "../../../src/features/mensajes/index.js";
import { API_KEY_TEST } from "../../helpers/fixtures.js";
import { headersDeLlamada, crearHttpDePrueba } from "../../helpers/http-prueba.js";
import { BASE_URL_PRUEBA, respuestaError, respuestaJsonData } from "../../helpers/mock-fetch.js";

const PHONE = "593999999999";

/** Fixture con la forma real de `msgSuccessSchema` de la API: `{ data: { message } }`. */
const exito = (message: string) => () => respuestaJsonData({ message });

const initDe = (fetchMock: { mock: { calls: unknown[][] } }, i = 0) =>
  fetchMock.mock.calls[i]?.[1] as RequestInit;
const urlDe = (fetchMock: { mock: { calls: unknown[][] } }, i = 0) =>
  fetchMock.mock.calls[i]?.[0] as string;

describe("mensajes.enviarTexto", () => {
  it("hace POST JSON a /v1/send/message y desenvuelve { message }", async () => {
    const { http, fetchMock } = crearHttpDePrueba(exito("mensaje enviado"));

    const r = await crearFacadeMensajes(http).enviarTexto({ phone: PHONE, message: "hola" });

    expect(r).toEqual({ success: true, data: { message: "mensaje enviado" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/send/message`);
    expect(initDe(fetchMock).method).toBe("POST");
    expect(initDe(fetchMock).body).toBe(JSON.stringify({ phone: PHONE, message: "hola" }));
    expect(headersDeLlamada(fetchMock).get("x-api-key")).toBe(API_KEY_TEST);
    expect(headersDeLlamada(fetchMock).get("content-type")).toBe("application/json");
  });

  it("mapea el 503 de sesión no disponible", async () => {
    const { http } = crearHttpDePrueba(() =>
      respuestaError(503, "Sesión de WhatsApp no disponible"),
    );

    const r = await crearFacadeMensajes(http).enviarTexto({ phone: PHONE, message: "hola" });

    expect(r).toMatchObject({
      success: false,
      codigo: 503,
      error: "Sesión de WhatsApp no disponible",
    });
  });

  it("rechaza un teléfono inválido con 422 sin llamar a la red", async () => {
    const { http, fetchMock } = crearHttpDePrueba(exito("x"));

    const r = await crearFacadeMensajes(http).enviarTexto({ phone: "+593999999999", message: "a" });

    expect(r).toMatchObject({
      success: false,
      codigo: 422,
      detalles: { fieldErrors: { phone: ["Número de teléfono inválido"] } },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("mensajes.enviarUbicacion", () => {
  it("hace POST JSON a /v1/send/location con latitude y longitude", async () => {
    const { http, fetchMock } = crearHttpDePrueba(exito("ubicación enviado"));

    const r = await crearFacadeMensajes(http).enviarUbicacion({
      phone: PHONE,
      latitude: -12.046374,
      longitude: -77.042793,
    });

    expect(r).toEqual({ success: true, data: { message: "ubicación enviado" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/send/location`);
    expect(JSON.parse(initDe(fetchMock).body as string)).toEqual({
      phone: PHONE,
      latitude: -12.046374,
      longitude: -77.042793,
    });
  });

  it("mapea el 400 de la API (p. ej. saldo insuficiente)", async () => {
    const { http } = crearHttpDePrueba(() => respuestaError(402, "Saldo insuficiente"));

    const r = await crearFacadeMensajes(http).enviarUbicacion({
      phone: PHONE,
      latitude: 1,
      longitude: 2,
    });

    expect(r).toMatchObject({ success: false, codigo: 402, error: "Saldo insuficiente" });
  });
});

describe("mensajes.enviarLote", () => {
  it("hace POST a /v1/send/batch y desenvuelve el resultado por destinatario", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() =>
      respuestaJsonData({
        totalEnviados: 1,
        totalFallidos: 1,
        resultados: [
          { destinatario: "5491155553333", exito: true },
          { destinatario: "5491166664444", exito: false, error: "No se pudo enviar el mensaje." },
        ],
      }),
    );

    const r = await crearFacadeMensajes(http).enviarLote({
      destinatarios: ["5491155553333", "5491166664444"],
      mensaje: "Hola",
    });

    expect(r).toEqual({
      success: true,
      data: {
        totalEnviados: 1,
        totalFallidos: 1,
        resultados: [
          { destinatario: "5491155553333", exito: true },
          { destinatario: "5491166664444", exito: false, error: "No se pudo enviar el mensaje." },
        ],
      },
    });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/send/batch`);
    expect(JSON.parse(initDe(fetchMock).body as string)).toEqual({
      destinatarios: ["5491155553333", "5491166664444"],
      mensaje: "Hola",
    });
  });

  it("rechaza más de 500 destinatarios sin llamar a la red", async () => {
    const { http, fetchMock } = crearHttpDePrueba(exito("x"));

    const r = await crearFacadeMensajes(http).enviarLote({
      destinatarios: Array.from({ length: 501 }, () => "5491155553333"),
      mensaje: "Hola",
    });

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mapea un 429 con retryAfter", async () => {
    const { http } = crearHttpDePrueba(() =>
      respuestaError(429, "Demasiadas solicitudes", { "Retry-After": "7" }),
    );

    const r = await crearFacadeMensajes(http).enviarLote({
      destinatarios: ["5491155553333"],
      mensaje: "Hola",
    });

    expect(r).toMatchObject({ success: false, codigo: 429, retryAfter: 7 });
  });
});

describe("mensajes — media (multipart)", () => {
  it("enviarImagen con url: multipart con phone, url y caption, sin content-type manual", async () => {
    const { http, fetchMock } = crearHttpDePrueba(exito("imagen enviado"));

    const r = await crearFacadeMensajes(http).enviarImagen({
      phone: PHONE,
      url: "https://example.com/image.png",
      caption: "Mira",
    });

    expect(r).toEqual({ success: true, data: { message: "imagen enviado" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/send/image`);
    expect(initDe(fetchMock).method).toBe("POST");
    const form = initDe(fetchMock).body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get("phone")).toBe(PHONE);
    expect(form.get("url")).toBe("https://example.com/image.png");
    expect(form.get("caption")).toBe("Mira");
    expect(form.has("file")).toBe(false);
    expect(headersDeLlamada(fetchMock).has("content-type")).toBe(false);
    expect(headersDeLlamada(fetchMock).get("x-api-key")).toBe(API_KEY_TEST);
  });

  it("enviarImagen con Blob: adjunta el archivo con su tipo", async () => {
    const { http, fetchMock } = crearHttpDePrueba(exito("imagen enviado"));
    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" });

    await crearFacadeMensajes(http).enviarImagen({ phone: PHONE, file: blob });

    const archivo = (initDe(fetchMock).body as FormData).get("file") as File;
    expect(archivo.type).toBe("image/png");
    expect(archivo.size).toBe(4);
    expect((initDe(fetchMock).body as FormData).has("url")).toBe(false);
  });

  it("enviarVideo con bytes: arma el Blob con tipoContenido y nombre", async () => {
    const { http, fetchMock } = crearHttpDePrueba(exito("video enviado"));

    const r = await crearFacadeMensajes(http).enviarVideo({
      phone: PHONE,
      file: { bytes: new Uint8Array([1, 2, 3]), tipoContenido: "video/mp4", nombre: "clip.mp4" },
    });

    expect(r).toEqual({ success: true, data: { message: "video enviado" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/send/video`);
    const archivo = (initDe(fetchMock).body as FormData).get("file") as File;
    expect(archivo.type).toBe("video/mp4");
    expect(archivo.name).toBe("clip.mp4");
    expect(new Uint8Array(await archivo.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("enviarGif apunta a /v1/send/gif", async () => {
    const { http, fetchMock } = crearHttpDePrueba(exito("gif enviado"));

    const r = await crearFacadeMensajes(http).enviarGif({
      phone: PHONE,
      url: "https://example.com/anim.gif",
    });

    expect(r).toEqual({ success: true, data: { message: "gif enviado" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/send/gif`);
  });

  it("enviarPdf incluye fileName en el multipart", async () => {
    const { http, fetchMock } = crearHttpDePrueba(exito("pdf enviado"));

    const r = await crearFacadeMensajes(http).enviarPdf({
      phone: PHONE,
      url: "https://example.com/document.pdf",
      fileName: "factura.pdf",
    });

    expect(r).toEqual({ success: true, data: { message: "pdf enviado" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/send/pdf`);
    expect((initDe(fetchMock).body as FormData).get("fileName")).toBe("factura.pdf");
  });

  it("rechaza url y file juntos, y ninguno de los dos, sin llamar a la red", async () => {
    const { http, fetchMock } = crearHttpDePrueba(exito("x"));
    const facade = crearFacadeMensajes(http);

    const ambos = await facade.enviarImagen({
      phone: PHONE,
      url: "https://example.com/a.png",
      file: new Blob(["x"], { type: "image/png" }),
    });
    const ninguno = await facade.enviarImagen({ phone: PHONE });

    expect(ambos).toMatchObject({ success: false, codigo: 422 });
    expect(ninguno).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mapea el 413 de un archivo demasiado grande", async () => {
    const { http } = crearHttpDePrueba(() =>
      respuestaError(413, "El archivo de imagen excede el tamaño máximo permitido"),
    );

    const r = await crearFacadeMensajes(http).enviarImagen({
      phone: PHONE,
      file: new Blob(["x"], { type: "image/png" }),
    });

    expect(r).toMatchObject({
      success: false,
      codigo: 413,
      error: "El archivo de imagen excede el tamaño máximo permitido",
    });
  });
});
