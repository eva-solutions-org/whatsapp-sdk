/**
 * Schemas Zod del feature `buffer-ws` — espejo de
 * `features/notifications/domain/ws-buffer-schemas.ts` de la API: eventos que quedaron en el
 * buffer porque no había un cliente WebSocket conectado.
 */

import { z } from "zod";
import { paginacionSchema } from "../../../core/validacion/index.js";

// ─── INPUT ────────────────────────────────────────────────────────────────

export const listarWsPendientesInputSchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const idWsPendienteSchema = z.number().int().min(1);

// ─── RESPONSE ─────────────────────────────────────────────────────────────

const eventoWsPendienteSchema = z.object({
  id: z.number(),
  phone: z.string(),
  tipoEvento: z.string(),
  /** Evento original serializado como JSON (string). */
  payload: z.string(),
  createdAt: z.string(),
});

export const listarWsPendientesResponseSchema = z.object({
  data: z.array(eventoWsPendienteSchema),
  pagination: paginacionSchema,
});

export const conteoWsPendientesSchema = z.object({ count: z.number() });

/** `{ message }` de las eliminaciones (`eliminarTodos` trae la cantidad en el texto). */
export const confirmacionWsPendienteSchema = z.object({ message: z.string() });

// ─── TIPOS ────────────────────────────────────────────────────────────────

export type ListarWsPendientesInput = z.input<typeof listarWsPendientesInputSchema>;
export type EventoWsPendiente = z.infer<typeof eventoWsPendienteSchema>;
export type ListarWsPendientesResponse = z.infer<typeof listarWsPendientesResponseSchema>;
export type ConteoWsPendientes = z.infer<typeof conteoWsPendientesSchema>;
export type ConfirmacionWsPendiente = z.infer<typeof confirmacionWsPendienteSchema>;
