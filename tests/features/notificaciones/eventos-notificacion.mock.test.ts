import { describe, expect, it } from "vitest";
import { eventoNotificacionSchema } from "../../../src/ws.js";
import { eventoWebhookSchema } from "../../../src/webhooks.js";
import { EVENTO_MENSAJE_TEXTO_FIXTURE } from "../../helpers/fixtures.js";

const mensaje = (messageType: string, content: unknown) => ({
  ...EVENTO_MENSAJE_TEXTO_FIXTURE,
  data: { ...EVENTO_MENSAJE_TEXTO_FIXTURE.data, messageType, content },
});

describe("eventoNotificacionSchema", () => {
  it.each([
    ["image", { caption: "foto", mimetype: "image/jpeg", fileSize: 1024, mediaUrl: "https://m/x" }],
    ["audio", { mimetype: "audio/ogg" }],
    ["sticker", {}],
    ["location", { latitude: -0.18, longitude: -78.46, name: "Quito" }],
    ["contact", { displayName: "Ana", vcard: "BEGIN:VCARD" }],
    ["reaction", { text: "👍", targetMessageId: "3EB0X" }],
  ])("acepta un mensaje %s con su contenido", (tipo, contenido) => {
    const r = eventoNotificacionSchema.safeParse(mensaje(tipo, contenido));

    expect(r.success).toBe(true);
    expect(r.success && r.data.type === "message" && r.data.data.content).toEqual(contenido);
  });

  it("rechaza un contenido que no corresponde al messageType", () => {
    const r = eventoNotificacionSchema.safeParse(mensaje("location", { text: "no es ubicación" }));

    expect(r.success).toBe(false);
  });

  it("un messageType conocido con content inválido sigue fallando (no cae al respaldo)", () => {
    expect(eventoNotificacionSchema.safeParse(mensaje("text", {})).success).toBe(false);
    expect(eventoNotificacionSchema.safeParse(mensaje("image", "no-objeto")).success).toBe(false);
  });

  it("mantiene estricto el schema público: un messageType nuevo no parsea aquí (lo absorbe clasificarEvento)", () => {
    expect(eventoNotificacionSchema.safeParse(mensaje("poll", { q: "?" })).success).toBe(false);
  });

  it("estrecha el content de los messageType conocidos", () => {
    const r = eventoNotificacionSchema.safeParse(mensaje("text", { text: "hola" }));

    expect(r.success).toBe(true);
    if (r.success && r.data.type === "message" && r.data.data.messageType === "text") {
      expect(r.data.data.content.text).toBe("hola");
    } else {
      expect.unreachable("se esperaba un mensaje text");
    }
  });

  it("tolera un connection.data.status nuevo", () => {
    const evento = (status: string) => ({
      type: "connection",
      phone: "1",
      timestamp: 1,
      data: { status, message: "m" },
    });

    expect(eventoNotificacionSchema.safeParse(evento("open")).success).toBe(true);
    expect(eventoNotificacionSchema.safeParse(evento("connecting")).success).toBe(true);
    expect(
      eventoNotificacionSchema.safeParse({ ...evento("open"), data: { status: 1 } }).success,
    ).toBe(false);
  });

  it("acepta billing_alert con campos opcionales", () => {
    const r = eventoNotificacionSchema.safeParse({
      type: "billing_alert",
      phone: "593999999999",
      timestamp: 1,
      data: { subtipo: "gracia_inicio", mensaje: "En gracia", horasEnGracia: 48 },
    });

    expect(r.success).toBe(true);
  });

  it("acepta message_status con un estado conocido y tolera uno nuevo (forward-compat)", () => {
    const evento = (status: string) => ({
      type: "message_status",
      phone: "1",
      timestamp: 1,
      data: { remoteJid: "593@s.whatsapp.net", messageId: "m1", status, timestamp: "2026-01-01" },
    });

    expect(eventoNotificacionSchema.safeParse(evento("leido")).success).toBe(true);
    expect(eventoNotificacionSchema.safeParse(evento("borrado")).success).toBe(true);
    expect(eventoNotificacionSchema.safeParse({ ...evento("leido"), data: 1 }).success).toBe(false);
  });
});

describe("eventoWebhookSchema", () => {
  it("no acepta billing_alert: solo viaja por WebSocket", () => {
    const r = eventoWebhookSchema.safeParse({
      type: "billing_alert",
      phone: "1",
      timestamp: 1,
      data: { subtipo: "bloqueado", mensaje: "x" },
    });

    expect(r.success).toBe(false);
  });
});
