import { z } from "zod";
import { enumTolerante } from "../../../core/validacion/index.js";

/**
 * Eventos de notificación de la API (espejo de `Whatsapp-api/src/features/notifications/
 * domain/notification-events.ts`). Los comparten el webhook (`./webhooks`) y el WebSocket
 * (`./ws`): todos tienen el envelope `{ type, phone, data, timestamp }`.
 *
 * Los schemas son la fuente de verdad; los tipos se derivan con `z.infer`.
 */

export const TIPOS_MENSAJE = [
  "text",
  "image",
  "video",
  "audio",
  "document",
  "sticker",
  "location",
  "contact",
  "reaction",
] as const;

export type TipoMensaje = (typeof TIPOS_MENSAJE)[number];

const contenidoTextoSchema = z.object({ text: z.string() });

const contenidoMediaSchema = z.object({
  caption: z.string().optional(),
  mimetype: z.string().optional(),
  fileSize: z.number().optional(),
  mediaUrl: z.string().optional(),
});

const contenidoUbicacionSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
});

const contenidoContactoSchema = z.object({ displayName: z.string(), vcard: z.string() });

const contenidoReaccionSchema = z.object({ text: z.string(), targetMessageId: z.string() });

const camposComunesMensaje = {
  messageId: z.string(),
  from: z.string(),
  fromName: z.string().nullable(),
  isGroup: z.boolean(),
  groupId: z.string().nullable(),
  quotedMessage: z.object({ messageId: z.string(), from: z.string() }).nullable(),
  timestamp: z.number(),
};

/** Datos de un mensaje entrante; `messageType` determina la forma de `content`. */
const datosMensajeSchema = z.discriminatedUnion("messageType", [
  z.object({
    ...camposComunesMensaje,
    messageType: z.literal("text"),
    content: contenidoTextoSchema,
  }),
  z.object({
    ...camposComunesMensaje,
    messageType: z.enum(["image", "video", "audio", "document", "sticker"]),
    content: contenidoMediaSchema,
  }),
  z.object({
    ...camposComunesMensaje,
    messageType: z.literal("location"),
    content: contenidoUbicacionSchema,
  }),
  z.object({
    ...camposComunesMensaje,
    messageType: z.literal("contact"),
    content: contenidoContactoSchema,
  }),
  z.object({
    ...camposComunesMensaje,
    messageType: z.literal("reaction"),
    content: contenidoReaccionSchema,
  }),
]);

export const ESTADOS_MENSAJE = ["enviado", "entregado", "leido", "reproducido"] as const;
export type EstadoMensaje = (typeof ESTADOS_MENSAJE)[number];

export const SUBTIPOS_ALERTA_BILLING = [
  "saldo_bajo",
  "gracia_inicio",
  "gracia_solo_recibir",
  "bloqueado",
] as const;
export type SubtipoAlertaBilling = (typeof SUBTIPOS_ALERTA_BILLING)[number];

export const ESTADOS_CONEXION = ["open", "close"] as const;

const envelope = { phone: z.string(), timestamp: z.number() };

const eventoConexionSchema = z.object({
  ...envelope,
  type: z.literal("connection"),
  data: z.object({ status: enumTolerante(ESTADOS_CONEXION), message: z.string() }),
});

const eventoQrSchema = z.object({
  ...envelope,
  type: z.literal("qr"),
  data: z.object({ qr: z.string() }),
});

const eventoMensajeSchema = z.object({
  ...envelope,
  type: z.literal("message"),
  data: datosMensajeSchema,
});

const eventoWebhookBloqueadoSchema = z.object({
  ...envelope,
  type: z.literal("webhook_blocked"),
  data: z.object({ message: z.string(), url: z.string() }),
});

const eventoEstadoMensajeSchema = z.object({
  ...envelope,
  type: z.literal("message_status"),
  data: z.object({
    remoteJid: z.string(),
    messageId: z.string(),
    status: enumTolerante(ESTADOS_MENSAJE),
    timestamp: z.string(),
  }),
});

const eventoAlertaBillingSchema = z.object({
  ...envelope,
  type: z.literal("billing_alert"),
  data: z.object({
    subtipo: enumTolerante(SUBTIPOS_ALERTA_BILLING),
    mensaje: z.string(),
    balance: z.string().optional(),
    umbral: z.string().optional(),
    moneda: z.string().optional(),
    horasEnGracia: z.number().nullable().optional(),
  }),
});

/**
 * Eventos que se pueden entregar por webhook (los 5 de `eventosWebhookValidos` de la API;
 * `billing_alert` solo viaja por WebSocket).
 */
export const eventoWebhookSchema = z.discriminatedUnion("type", [
  eventoConexionSchema,
  eventoQrSchema,
  eventoMensajeSchema,
  eventoWebhookBloqueadoSchema,
  eventoEstadoMensajeSchema,
]);

/** Todos los eventos de notificación (webhook + WebSocket). */
export const eventoNotificacionSchema = z.discriminatedUnion("type", [
  eventoConexionSchema,
  eventoQrSchema,
  eventoMensajeSchema,
  eventoWebhookBloqueadoSchema,
  eventoEstadoMensajeSchema,
  eventoAlertaBillingSchema,
]);

/**
 * Respaldo forward-compat (uso interno de `clasificarEvento`): un `message` cuyo `messageType`
 * es nuevo para esta versión del SDK. Valida el envelope y los campos comunes con `content`
 * genérico. Un `messageType` conocido NO pasa por aquí: su `content` inválido sigue siendo un
 * fallo de contrato. Los schemas públicos se mantienen estrictos para conservar el narrowing
 * de `content` por `messageType`.
 */
export const eventoMensajeDesconocidoSchema = z.object({
  ...envelope,
  type: z.literal("message"),
  data: z.object({
    ...camposComunesMensaje,
    messageType: z.string().refine((tipo) => !(TIPOS_MENSAJE as readonly string[]).includes(tipo)),
    content: z.unknown(),
  }),
});

export type EventoWebhook = z.infer<typeof eventoWebhookSchema>;
export type EventoNotificacion = z.infer<typeof eventoNotificacionSchema>;
export type TipoEventoNotificacion = EventoNotificacion["type"];
export type TipoEventoWebhook = EventoWebhook["type"];
/** Evento `message` entrante, con `content` discriminado por `messageType`. */
export type EventoMensaje = Extract<EventoNotificacion, { type: "message" }>;
