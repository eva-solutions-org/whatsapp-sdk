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
    esperarBearer(enviada.headers);
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

  it("no envía el signal en el body y el token solo viaja en Authorization", async () => {
    const { interno, fetchMock } = crearInternoPrueba(() =>
      respuestaJsonData({ message: "Mensaje enviado" }),
    );

    await interno.mensajes.enviar(TEXTO, { signal: new AbortController().signal });

    const enviada = peticion(fetchMock);
    expect(enviada.cuerpo).toEqual(TEXTO);
    expect(JSON.stringify(enviada.cuerpo)).not.toContain(TOKEN_SERVICIO_TEST);
    expect(enviada.headers.get("authorization")).toBe(`Bearer ${TOKEN_SERVICIO_TEST}`);
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

  it("401 por token inválido: mapea { error: { code, message } } con codigoApi, sin filtrar el token", async () => {
    const { interno } = crearInternoPrueba(() =>
      respuestaErrorToken(401, "invalid_token", "Token inválido o vencido"),
    );

    const r = await interno.mensajes.enviar(TEXTO);

    expect(r).toMatchObject({
      success: false,
      codigo: 401,
      error: "Token inválido o vencido",
      codigoApi: "invalid_token",
    });
    expect(JSON.stringify(r)).not.toContain(TOKEN_SERVICIO_TEST);
  });

  it("403 por permiso insuficiente en el token se mapea como fallo de la API", async () => {
    const { interno } = crearInternoPrueba(() => respuestaError(403, "Permiso insuficiente"));

    const r = await interno.mensajes.enviar(TEXTO);

    expect(r).toMatchObject({ success: false, codigo: 403, origen: "api" });
  });

  it("ante un 401 invalida el token y reintenta el POST una vez con el token nuevo", async () => {
    const tokens = ["token-viejo", "token-nuevo"];
    const obtenerToken = vi.fn(() => Promise.resolve(tokens.shift() as string));
    const invalidarToken = vi.fn();
    let llamada = 0;
    const fetchMock = crearMockFetch(() =>
      (llamada += 1) === 1
        ? respuestaErrorToken(401, "invalid_token", "Token vencido")
        : respuestaJsonData({ message: "Mensaje enviado" }),
    );
    const interno = crearClienteInterno({
      baseUrl: BASE_URL_PRUEBA,
      obtenerToken,
      invalidarToken,
      fetch: fetchMock,
      reintentos: { maximo: 0 },
    });

    const r = await interno.mensajes.enviar(TEXTO);

    expect(r).toEqual({ success: true, data: { message: "Mensaje enviado" } });
    expect(invalidarToken).toHaveBeenCalledExactlyOnceWith("token-viejo");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(peticion(fetchMock, 0).headers.get("authorization")).toBe("Bearer token-viejo");
    expect(peticion(fetchMock, 1).headers.get("authorization")).toBe("Bearer token-nuevo");
  });

  it("un segundo 401 no se reintenta: devuelve el fallo tras una sola invalidación", async () => {
    const invalidarToken = vi.fn();
    const fetchMock = crearMockFetch(() =>
      respuestaErrorToken(401, "invalid_token", "Token inválido"),
    );
    const interno = crearClienteInterno({
      baseUrl: BASE_URL_PRUEBA,
      obtenerToken: () => Promise.resolve(TOKEN_SERVICIO_TEST),
      invalidarToken,
      fetch: fetchMock,
      reintentos: { maximo: 3, esperaBaseMs: 0, esperaMaximaMs: 0 },
    });

    const r = await interno.mensajes.enviar(TEXTO);

    expect(r).toMatchObject({ success: false, codigo: 401, codigoApi: "invalid_token" });
    expect(invalidarToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("un POST que falla con 503 no se reintenta aunque el cliente permita reintentos", async () => {
    // El cliente de prueba usa reintentos: { maximo: 0 }; aquí se habilitan para probar que el
    // core igual NO reintenta un POST (el mensaje pudo haber salido).
    const fetchMock = crearMockFetch(() => respuestaError(503, "Sesión no disponible"));
    const interno = crearClienteInterno({
      baseUrl: BASE_URL_PRUEBA,
      obtenerToken: () => Promise.resolve(TOKEN_SERVICIO_TEST),
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
