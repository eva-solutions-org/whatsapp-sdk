/**
 * Schemas Zod del feature `webhooks-fallidos` — espejo de
 * `features/webhook-delivery/domain/webhook-delivery-schemas.ts` de la API.
 */

import { z } from "zod";
import { enumTolerante, paginacionSchema } from "../../../core/validacion/index.js";

const ESTADOS_EVENTO_FALLIDO = ["pendiente", "reintentando", "entregado", "agotado"] as const;

// ─── INPUT ────────────────────────────────────────────────────────────────

export const listarWebhooksFallidosInputSchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  estado: z.enum(ESTADOS_EVENTO_FALLIDO).optional(),
});

export const idEventoFallidoSchema = z.number().int().min(1);

// ─── RESPONSE ─────────────────────────────────────────────────────────────

const eventoFallidoSchema = z.object({
  id: z.number(),
  phone: z.string(),
  tipoEvento: z.string(),
  /** Evento original serializado como JSON (string). */
  payload: z.string(),
  codigoEstado: z.number().nullable(),
  mensajeError: z.string().nullable(),
  estado: enumTolerante(ESTADOS_EVENTO_FALLIDO),
  intentos: z.number(),
  maxIntentos: z.number(),
  proximoReintento: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const listarWebhooksFallidosResponseSchema = z.object({
  data: z.array(eventoFallidoSchema),
  pagination: paginacionSchema,
});

/** `{ message }` de reintentar / reintentar todos / descartar. */
export const confirmacionWebhookFallidoSchema = z.object({ message: z.string() });

// ─── TIPOS ────────────────────────────────────────────────────────────────

export type EstadoEventoFallido = (typeof ESTADOS_EVENTO_FALLIDO)[number];
export type ListarWebhooksFallidosInput = z.input<typeof listarWebhooksFallidosInputSchema>;
export type EventoWebhookFallido = z.infer<typeof eventoFallidoSchema>;
export type ListarWebhooksFallidosResponse = z.infer<typeof listarWebhooksFallidosResponseSchema>;
export type ConfirmacionWebhookFallido = z.infer<typeof confirmacionWebhookFallidoSchema>;
