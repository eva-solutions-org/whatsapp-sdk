import { describe, expect, it } from "vitest";
import { verificarWebhookDesdeRequest } from "../../../src/webhooks.js";
import {
  EVENTO_CONEXION_FIXTURE,
  EVENTO_MENSAJE_TEXTO_FIXTURE,
  SECRETO_WEBHOOK_TEST,
  generarFirmaWebhookTest,
} from "../../helpers/fixtures.js";

const URL_WEBHOOK = "https://receptor.example.com/hooks/whatsapp";

const crearRequest = (
  cuerpo: string,
  headers: Record<string, string> = {},
  firmar = true,
): Request =>
  new Request(URL_WEBHOOK, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(firmar && {
        "X-Webhook-Signature": generarFirmaWebhookTest(cuerpo, SECRETO_WEBHOOK_TEST),
      }),
      ...headers,
    },
    body: cuerpo,
  });

describe("verificarWebhookDesdeRequest", () => {
  it("verifica la firma y retorna el evento message tipado", async () => {
    const cuerpo = JSON.stringify(EVENTO_MENSAJE_TEXTO_FIXTURE);

    const r = await verificarWebhookDesdeRequest(crearRequest(cuerpo), SECRETO_WEBHOOK_TEST);

    expect(r).toEqual({ success: true, data: { evento: EVENTO_MENSAJE_TEXTO_FIXTURE } });
  });

  it("retorna el evento connection", async () => {
    const cuerpo = JSON.stringify(EVENTO_CONEXION_FIXTURE);

    const r = await verificarWebhookDesdeRequest(crearRequest(cuerpo), SECRETO_WEBHOOK_TEST);

    expect(r).toEqual({ success: true, data: { evento: EVENTO_CONEXION_FIXTURE } });
  });

  it("acepta un message con messageType nuevo (forward-compat) en vez de 422", async () => {
    const evento = {
      ...EVENTO_MENSAJE_TEXTO_FIXTURE,
      data: { ...EVENTO_MENSAJE_TEXTO_FIXTURE.data, messageType: "poll", content: { q: "?" } },
    };

    const r = await verificarWebhookDesdeRequest(
      crearRequest(JSON.stringify(evento)),
      SECRETO_WEBHOOK_TEST,
    );

    expect(r).toEqual({ success: true, data: { evento: { ...evento, conocido: false } } });
  });

  it("acepta un connection con status nuevo (forward-compat)", async () => {
    const evento = { ...EVENTO_CONEXION_FIXTURE, data: { status: "connecting", message: "x" } };

    const r = await verificarWebhookDesdeRequest(
      crearRequest(JSON.stringify(evento)),
      SECRETO_WEBHOOK_TEST,
    );

    expect(r).toEqual({ success: true, data: { evento } });
  });

  it("estrecha el tipo del contenido según messageType", async () => {
    const cuerpo = JSON.stringify(EVENTO_MENSAJE_TEXTO_FIXTURE);

    const r = await verificarWebhookDesdeRequest(crearRequest(cuerpo), SECRETO_WEBHOOK_TEST);

    expect(r.success).toBe(true);
    if (r.success && r.data.evento.conocido !== false && r.data.evento.type === "message") {
      const { data } = r.data.evento;
      expect(data.messageType === "text" ? data.content.text : null).toBe("hola");
    } else {
      expect.unreachable("se esperaba un evento message");
    }
  });

  it("retorna 401 si falta el header X-Webhook-Signature", async () => {
    const cuerpo = JSON.stringify(EVENTO_CONEXION_FIXTURE);

    const r = await verificarWebhookDesdeRequest(
      crearRequest(cuerpo, {}, false),
      SECRETO_WEBHOOK_TEST,
    );

    expect(r).toEqual({
      success: false,
      codigo: 401,
      origen: "local",
      error: "Header X-Webhook-Signature ausente",
    });
  });

  it("lee el header sin distinguir mayúsculas en el nombre", async () => {
    const cuerpo = JSON.stringify(EVENTO_CONEXION_FIXTURE);
    const request = crearRequest(
      cuerpo,
      {
        "x-webhook-signature": generarFirmaWebhookTest(cuerpo, SECRETO_WEBHOOK_TEST),
      },
      false,
    );

    const r = await verificarWebhookDesdeRequest(request, SECRETO_WEBHOOK_TEST);

    expect(r.success).toBe(true);
  });

  it("retorna 401 con el secreto equivocado", async () => {
    const cuerpo = JSON.stringify(EVENTO_CONEXION_FIXTURE);

    const r = await verificarWebhookDesdeRequest(crearRequest(cuerpo), "secreto-ajeno");

    expect(r).toEqual({ success: false, codigo: 401, origen: "local", error: "Firma inválida" });
  });

  it("usa opciones.cuerpoCrudo cuando el stream ya fue consumido", async () => {
    const cuerpo = JSON.stringify(EVENTO_CONEXION_FIXTURE);
    const request = crearRequest(cuerpo);
    await request.text();

    const r = await verificarWebhookDesdeRequest(request, SECRETO_WEBHOOK_TEST, {
      cuerpoCrudo: cuerpo,
    });

    expect(r).toEqual({ success: true, data: { evento: EVENTO_CONEXION_FIXTURE } });
  });

  it("retorna 422 si el stream ya fue consumido y no se pasa cuerpoCrudo", async () => {
    const cuerpo = JSON.stringify(EVENTO_CONEXION_FIXTURE);
    const request = crearRequest(cuerpo);
    await request.text();

    const r = await verificarWebhookDesdeRequest(request, SECRETO_WEBHOOK_TEST);

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(r.success === false && r.error).toContain("cuerpoCrudo");
  });

  it("retorna 413 si Content-Length declara más del tope, sin leer el body", async () => {
    const cuerpo = JSON.stringify(EVENTO_CONEXION_FIXTURE);
    const request = crearRequest(cuerpo, { "content-length": "2048" });

    const r = await verificarWebhookDesdeRequest(request, SECRETO_WEBHOOK_TEST, {
      maxBytesCuerpo: 1024,
    });

    expect(r).toEqual({
      success: false,
      codigo: 413,
      origen: "local",
      error: "Body demasiado grande",
    });
  });

  it("retorna 413 si el stream excede el tope sin Content-Length", async () => {
    const trozo = new TextEncoder().encode("x".repeat(600));
    const stream = new ReadableStream<Uint8Array>({
      start(controlador) {
        controlador.enqueue(trozo);
        controlador.enqueue(trozo);
        controlador.close();
      },
    });
    const request = new Request(URL_WEBHOOK, {
      method: "POST",
      headers: { "X-Webhook-Signature": `sha256=${"a".repeat(64)}` },
      body: stream,
      duplex: "half",
    } as RequestInit);

    const r = await verificarWebhookDesdeRequest(request, SECRETO_WEBHOOK_TEST, {
      maxBytesCuerpo: 1000,
    });

    expect(r).toEqual({
      success: false,
      codigo: 413,
      origen: "local",
      error: "Body demasiado grande",
    });
  });

  it("retorna 413 si opciones.cuerpoCrudo excede el tope", async () => {
    const request = crearRequest("{}");

    const r = await verificarWebhookDesdeRequest(request, SECRETO_WEBHOOK_TEST, {
      cuerpoCrudo: "x".repeat(11),
      maxBytesCuerpo: 10,
    });

    expect(r).toEqual({
      success: false,
      codigo: 413,
      origen: "local",
      error: "Body demasiado grande",
    });
  });

  it("retorna 422 si la firma es válida pero el cuerpo no es JSON", async () => {
    const r = await verificarWebhookDesdeRequest(crearRequest("no-json"), SECRETO_WEBHOOK_TEST);

    expect(r).toEqual({
      success: false,
      codigo: 422,
      origen: "local",
      error: "Body no es JSON válido",
    });
  });

  it("entrega un tipo de evento desconocido como EventoDesconocido (forward-compat)", async () => {
    const cuerpo = JSON.stringify({
      type: "evento_nuevo",
      phone: "1",
      data: { a: 1 },
      timestamp: 1,
    });

    const r = await verificarWebhookDesdeRequest(crearRequest(cuerpo), SECRETO_WEBHOOK_TEST);

    expect(r).toEqual({
      success: true,
      data: {
        evento: { type: "evento_nuevo", phone: "1", data: { a: 1 }, timestamp: 1, conocido: false },
      },
    });
  });

  it("billing_alert (solo WebSocket) llega por webhook como desconocido", async () => {
    const cuerpo = JSON.stringify({ type: "billing_alert", phone: "1", data: {}, timestamp: 1 });

    const r = await verificarWebhookDesdeRequest(crearRequest(cuerpo), SECRETO_WEBHOOK_TEST);

    expect(r.success && r.data.evento.conocido).toBe(false);
  });

  it("los eventos conocidos no llevan la marca conocido", async () => {
    const cuerpo = JSON.stringify(EVENTO_CONEXION_FIXTURE);

    const r = await verificarWebhookDesdeRequest(crearRequest(cuerpo), SECRETO_WEBHOOK_TEST);

    expect(r.success && "conocido" in r.data.evento).toBe(false);
  });

  it("retorna 422 si el cuerpo firmado no trae type string", async () => {
    const cuerpo = JSON.stringify({ phone: "1", data: {}, timestamp: 1 });

    const r = await verificarWebhookDesdeRequest(crearRequest(cuerpo), SECRETO_WEBHOOK_TEST);

    expect(r).toMatchObject({ success: false, codigo: 422 });
  });

  it("retorna 422 si el evento conocido tiene un campo requerido ausente", async () => {
    const { status: _status, ...sinStatus } = EVENTO_CONEXION_FIXTURE.data;
    const cuerpo = JSON.stringify({ ...EVENTO_CONEXION_FIXTURE, data: sinStatus });

    const r = await verificarWebhookDesdeRequest(crearRequest(cuerpo), SECRETO_WEBHOOK_TEST);

    expect(r).toMatchObject({ success: false, codigo: 422 });
  });
});
