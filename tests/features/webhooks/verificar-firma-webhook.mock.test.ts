import { describe, expect, it } from "vitest";
import { verificarFirmaWebhook } from "../../../src/webhooks.js";
import {
  EVENTO_MENSAJE_TEXTO_FIXTURE,
  SECRETO_WEBHOOK_TEST,
  generarFirmaWebhookTest,
} from "../../helpers/fixtures.js";

const cuerpo = JSON.stringify(EVENTO_MENSAJE_TEXTO_FIXTURE);

describe("verificarFirmaWebhook", () => {
  it("acepta la firma que genera la API (HMAC-SHA256 hex sobre el cuerpo exacto)", async () => {
    const firma = generarFirmaWebhookTest(cuerpo, SECRETO_WEBHOOK_TEST);

    const r = await verificarFirmaWebhook({
      cuerpoCrudo: cuerpo,
      firma,
      secreto: SECRETO_WEBHOOK_TEST,
    });

    expect(r).toEqual({ success: true, data: true });
  });

  it("acepta el cuerpo como bytes (UTF-8 con caracteres no ASCII)", async () => {
    const texto = JSON.stringify({ ...EVENTO_MENSAJE_TEXTO_FIXTURE, extra: "ñandú 😀" });
    const bytes = new TextEncoder().encode(texto);
    const firma = generarFirmaWebhookTest(bytes, SECRETO_WEBHOOK_TEST);

    const r = await verificarFirmaWebhook({
      cuerpoCrudo: bytes,
      firma,
      secreto: SECRETO_WEBHOOK_TEST,
    });

    expect(r).toEqual({ success: true, data: true });
  });

  it("rechaza con 401 si el cuerpo fue alterado en un solo carácter", async () => {
    const firma = generarFirmaWebhookTest(cuerpo, SECRETO_WEBHOOK_TEST);

    const r = await verificarFirmaWebhook({
      cuerpoCrudo: cuerpo.replace("hola", "holA"),
      firma,
      secreto: SECRETO_WEBHOOK_TEST,
    });

    expect(r).toEqual({ success: false, codigo: 401, origen: "local", error: "Firma inválida" });
  });

  it("rechaza con 401 si el secreto es otro", async () => {
    const firma = generarFirmaWebhookTest(cuerpo, SECRETO_WEBHOOK_TEST);

    const r = await verificarFirmaWebhook({ cuerpoCrudo: cuerpo, firma, secreto: "otro-secreto" });

    expect(r).toEqual({ success: false, codigo: 401, origen: "local", error: "Firma inválida" });
  });

  it("rechaza con 401 si el JSON se re-serializa distinto del enviado", async () => {
    const firma = generarFirmaWebhookTest(cuerpo, SECRETO_WEBHOOK_TEST);
    const reserializado = JSON.stringify(JSON.parse(cuerpo), null, 2);

    const r = await verificarFirmaWebhook({
      cuerpoCrudo: reserializado,
      firma,
      secreto: SECRETO_WEBHOOK_TEST,
    });

    expect(r).toMatchObject({ success: false, codigo: 401 });
  });

  it.each([
    ["sin prefijo", "a".repeat(64)],
    ["prefijo en mayúsculas", `SHA256=${"a".repeat(64)}`],
    ["hex en mayúsculas", `sha256=${"A".repeat(64)}`],
    ["hex corto", `sha256=${"a".repeat(63)}`],
    ["hex largo", `sha256=${"a".repeat(65)}`],
    ["no hex", `sha256=${"z".repeat(64)}`],
    ["vacía", ""],
  ])("rechaza con 401 una firma con formato inválido (%s)", async (_caso, firma) => {
    const r = await verificarFirmaWebhook({
      cuerpoCrudo: cuerpo,
      firma,
      secreto: SECRETO_WEBHOOK_TEST,
    });

    expect(r).toMatchObject({ success: false, codigo: 401 });
    expect(r.success === false && r.error).toContain("Formato de firma inválido");
  });

  it("rechaza con 401 un secreto vacío aunque la firma coincida con un HMAC de clave vacía", async () => {
    const firma = generarFirmaWebhookTest(cuerpo, "");

    const r = await verificarFirmaWebhook({ cuerpoCrudo: cuerpo, firma, secreto: "" });

    expect(r).toEqual({
      success: false,
      codigo: 401,
      origen: "local",
      error: "secreto ausente o vacío",
    });
  });
});
