import type { ZodType } from "zod";
import { eventoMensajeDesconocidoSchema } from "./eventos-notificacion.js";
import type { EventoNotificacion, EventoWebhook } from "./eventos-notificacion.js";

/** Tipos de evento que el SDK conoce (deben coincidir con los schemas de este feature). */
export const TIPOS_EVENTO_WEBHOOK = [
  "connection",
  "qr",
  "message",
  "webhook_blocked",
  "message_status",
] as const;

export const TIPOS_EVENTO_NOTIFICACION = [...TIPOS_EVENTO_WEBHOOK, "billing_alert"] as const;

/**
 * Evento con un `type` que esta versión del SDK no conoce (forward-compat: la API puede
 * agregar tipos sin que sea un error). Se distingue de los conocidos con `conocido === false`.
 */
export type EventoDesconocido = {
  conocido: false;
  type: string;
  [clave: string]: unknown;
};

/**
 * Marca de tipo (no existe en runtime) para poder preguntar `evento.conocido === false` y
 * que, en la otra rama, `evento.type` estreche a las variantes conocidas.
 */
type Conocido<E> = E & { conocido?: undefined };

/** Evento de webhook conocido o desconocido. */
export type EventoWebhookRecibido = Conocido<EventoWebhook> | EventoDesconocido;
/** Evento de notificación (WebSocket) conocido o desconocido. */
export type EventoNotificacionRecibido = Conocido<EventoNotificacion> | EventoDesconocido;

export type ClasificacionEvento<E> =
  | { ok: true; evento: E | EventoDesconocido }
  | { ok: false; error: string; detalles?: unknown };

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === "object" && valor !== null && !Array.isArray(valor);

/**
 * Valida un JSON ya parseado contra el schema de eventos conocidos.
 *  - `type` conocido y forma válida -> evento tipado.
 *  - `type` conocido y forma inválida -> `ok: false` (el contrato conocido se rompió).
 *  - `message` con `messageType` nuevo (resto del evento válido) -> `EventoDesconocido`.
 *  - `type` string no conocido -> `EventoDesconocido` (no es error).
 *  - Sin `type` string -> `ok: false`.
 */
export const clasificarEvento = <E>(
  json: unknown,
  schema: ZodType<E>,
  tiposConocidos: readonly string[],
): ClasificacionEvento<E> => {
  if (!esObjeto(json) || typeof json["type"] !== "string") {
    return { ok: false, error: "Evento sin campo type" };
  }
  if (!tiposConocidos.includes(json["type"])) {
    return { ok: true, evento: { ...json, type: json["type"], conocido: false } };
  }
  const parseado = schema.safeParse(json);
  if (!parseado.success) {
    if (json["type"] === "message" && eventoMensajeDesconocidoSchema.safeParse(json).success) {
      return { ok: true, evento: { ...json, type: "message", conocido: false } };
    }
    return {
      ok: false,
      error: `Evento ${json["type"]} con forma inválida`,
      detalles: parseado.error.issues,
    };
  }
  return { ok: true, evento: parseado.data };
};
