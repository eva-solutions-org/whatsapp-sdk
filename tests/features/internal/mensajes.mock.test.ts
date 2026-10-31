import { describe, expect, it } from "vitest";
import { crearClienteInterno } from "../../../src/internal.js";
import { CLIENT_ID_S2S_TEST, SECRETO_S2S_HEX_TEST } from "../../helpers/fixtures.js";
import {
  BASE_URL_PRUEBA,
  crearMockFetch,
  respuestaError,
  respuestaErrorS2S,
  respuestaJsonData,
  respuestaValidacion422,
} from "../../helpers/mock-fetch.js";
import { crearInternoPrueba, esperarHeadersS2S, peticion } from "../../helpers/ayudas-s2s.js";

const TEXTO = { phone: "51999999999", message: "OTP: 123456", sourcePhone: "51988888888" };

describe("interno.mensajes.enviar", () => {
  it("texto: POST /messages/send con el body exacto y desenvuelve { message }", async () => {
    const { interno, fetchMock } = crearInternoPrueba(() =>
      respuestaJsonData({ message: "Mensaje enviado" }),
    );

    const r = await interno.mensajes.enviar(TEXTO);

    expect(r).toEqual({ success: true, data: { message: "Mensaje enviado" } });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("POST");
    expect(enviada.ruta).toBe("/v1/internal/messages/send");
    expect(enviada.query).toEqual({});
    expect(enviada.cuerpo).toEqual(TEXTO);
    esperarHeadersS2S(enviada.headers);
  });

  it("media: manda mediaUrl, mediaType y caption", async () => {
    const media = {
      phone: "51999999999",
      sourcePhone: "51988888888",
      mediaUrl: "https://example.com/documento.pdf",
      caption: "Tu recibo adjunto",
      mediaType: "document",
    } as const;
    const { interno, fetchMock } = crearInternoPrueba(() =>
      respuestaJsonData({ message: "Mensaje enviado" }),
    );

    const r = await interno.mensajes.enviar(media);

    expect(r).toEqual({ success: true, data: { message: "Mensaje enviado" } });
    expect(peticion(fetchMock).cuerpo).toEqual(media);
  });

  it("no envía el signal ni el secreto en el body ni en los headers", async () => {
    const { interno, fetchMock } = crearInternoPrueba(() =>
      respuestaJsonData({ message: "Mensaje enviado" }),
    );

    await interno.mensajes.enviar(TEXTO, { signal: new AbortController().signal });

    const enviada = peticion(fetchMock);
    expect(enviada.cuerpo).toEqual(TEXTO);
    expect(JSON.stringify([...enviada.headers.entries()])).not.toContain(SECRETO_S2S_HEX_TEST);
  });

  it("403 de allowlist/scope se mapea con el mensaje de la API", async () => {
    const { interno } = crearInternoPrueba(() =>
      respuestaError(403, "sourcePhone no permitido para este service client"),
    );

    const r = await interno.mensajes.enviar(TEXTO);

    expect(r).toMatchObject({
      success: false,
      codigo: 403,
      error: "sourcePhone no permitido para este service client",
    });
  });

  it("422 de body inválido conserva los detalles de validación", async () => {
    const { interno } = crearInternoPrueba(() =>
      respuestaValidacion422({ sourcePhone: ["String must contain at least 7 character(s)"] }),
    );

    const r = await interno.mensajes.enviar(TEXTO);

    expect(r).toMatchObject({
      success: false,
      codigo: 422,
      error: "Body inválido",
      detalles: {
        fieldErrors: { sourcePhone: ["String must contain at least 7 character(s)"] },
      },
    });
  });

  it("422 de sourcePhone desconocido llega como { error } simple", async () => {
    const { interno } = crearInternoPrueba(() => respuestaError(422, "sourcePhone desconocido"));

    const r = await interno.mensajes.enviar(TEXTO);

    expect(r).toMatchObject({ success: false, codigo: 422, error: "sourcePhone desconocido" });
  });

  it("503 de sesión no disponible", async () => {
    const { interno } = crearInternoPrueba(() =>
      respuestaError(503, "Sesión no disponible para el sourcePhone"),
    );

    const r = await interno.mensajes.enviar(TEXTO);

    expect(r).toMatchObject({
      success: false,
      codigo: 503,
      error: "Sesión no disponible para el sourcePhone",
    });
  });

  it("401 S2S { error: { code, message } } con codigoApi, sin filtrar el secreto", async () => {
    const { interno } = crearInternoPrueba(() =>
      respuestaErrorS2S(401, "invalid_signature", "Acceso no autorizado"),
    );

    const r = await interno.mensajes.enviar(TEXTO);

    expect(r).toMatchObject({
      success: false,
      codigo: 401,
      error: "Acceso no autorizado",
      codigoApi: "invalid_signature",
    });
    expect(JSON.stringify(r)).not.toContain(SECRETO_S2S_HEX_TEST);
  });

  it("un POST que falla con 503 no se reintenta aunque el cliente permita reintentos", async () => {
    // El cliente de prueba usa reintentos: { maximo: 0 }; aquí se habilitan para probar que el
    // core igual NO reintenta un POST (nonce de un solo uso).
    const fetchMock = crearMockFetch(() => respuestaError(503, "Sesión no disponible"));
    const interno = crearClienteInterno({
      baseUrl: BASE_URL_PRUEBA,
      clientId: CLIENT_ID_S2S_TEST,
      secretoHex: SECRETO_S2S_HEX_TEST,
      fetch: fetchMock,
      reintentos: { maximo: 3, esperaBaseMs: 0, esperaMaximaMs: 0 },
    });

    const r = await interno.mensajes.enviar(TEXTO);

    expect(r).toMatchObject({ success: false, codigo: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rechaza un body con message y mediaUrl a la vez (la API enviaría solo el texto)", async () => {
    const { interno, fetchMock } = crearInternoPrueba(() =>
      respuestaJsonData({ message: "Mensaje enviado" }),
    );

    const r = await interno.mensajes.enviar({
      ...TEXTO,
      mediaUrl: "https://example.com/a.png",
      mediaType: "image",
    } as never);

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza un mediaType desconocido sin enviar la request", async () => {
    const { interno, fetchMock } = crearInternoPrueba(() => respuestaJsonData({}));

    const r = await interno.mensajes.enviar({
      phone: "51999999999",
      sourcePhone: "51988888888",
      mediaUrl: "https://example.com/a.png",
      mediaType: "sticker",
    } as never);

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
