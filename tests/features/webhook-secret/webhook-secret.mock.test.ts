import { describe, expect, it } from "vitest";
import { crearFacadeWebhookSecret } from "../../../src/features/webhook-secret/index.js";
import { crearHttpDePrueba } from "../../helpers/http-prueba.js";
import { BASE_URL_PRUEBA, respuestaError, respuestaJsonData } from "../../helpers/mock-fetch.js";

type MockConLlamadas = { mock: { calls: unknown[][] } };
const urlDe = (m: MockConLlamadas) => m.mock.calls[0]?.[0] as string;
const initDe = (m: MockConLlamadas) => m.mock.calls[0]?.[1] as RequestInit;

describe("webhookSecret.enviar", () => {
  it("hace GET a /v1/me/webhook-secret y devuelve la confirmación (sin el secreto)", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() =>
      respuestaJsonData({ message: "Webhook secret enviado por WhatsApp" }),
    );

    const r = await crearFacadeWebhookSecret(http).enviar();

    expect(r).toEqual({ success: true, data: { message: "Webhook secret enviado por WhatsApp" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/webhook-secret`);
    expect(initDe(fetchMock).method).toBe("GET");
  });

  it("mapea el 404 cuando no hay secret configurado", async () => {
    const { http } = crearHttpDePrueba(() =>
      respuestaError(404, "No hay webhook secret configurado"),
    );

    const r = await crearFacadeWebhookSecret(http).enviar();

    expect(r).toMatchObject({
      success: false,
      codigo: 404,
      error: "No hay webhook secret configurado",
    });
  });

  it("mapea el 503 cuando el teléfono del sistema no está disponible", async () => {
    const { http } = crearHttpDePrueba(() =>
      respuestaError(503, "El teléfono del sistema no está disponible"),
    );

    const r = await crearFacadeWebhookSecret(http).enviar();

    expect(r).toMatchObject({ success: false, codigo: 503 });
  });

  it("no reintenta ante un 5xx: reenviaría el WhatsApp con el secreto", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaError(503, "caído"), {
      reintentos: { maximo: 2 },
    });

    const r = await crearFacadeWebhookSecret(http).enviar();

    expect(r).toMatchObject({ success: false, codigo: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
