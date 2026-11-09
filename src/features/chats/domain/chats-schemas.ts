/**
 * Schemas Zod del feature `chats` — espejo de `features/whatsapp/domain/chat-schemas.ts` de la
 * API (Whatsapp-api). Los nombres de campo son los del contrato de la API.
 */

import { z } from "zod";
import { telefonoSchema } from "../../../core/validacion/index.js";

/** Tope de `segundos` de la presencia temporal (`MAX_SEGUNDOS_PRESENCIA` de la API). */
export const MAX_SEGUNDOS_ESCRITURA = 25;

/** Tope de ids por llamada de lectura (`MAX_MENSAJES_LEIDOS` de la API). */
export const MAX_MENSAJES_LEIDOS = 50;

// ─── INPUT ────────────────────────────────────────────────────────────────

export const indicarEscrituraInputSchema = z.object({
  phone: telefonoSchema,
  estado: z.enum(["escribiendo", "grabando", "pausa"]),
  segundos: z.number().int().min(1).max(MAX_SEGUNDOS_ESCRITURA).optional(),
});

export const verificarExistenciaInputSchema = z.object({ phone: telefonoSchema });

export const marcarLeidoInputSchema = z.object({
  phone: telefonoSchema,
  messageIds: z.array(z.string().min(1).max(100)).min(1).max(MAX_MENSAJES_LEIDOS),
});

export const cambiarPresenciaInputSchema = z.object({
  estado: z.enum(["en_linea", "desconectado"]),
});

// ─── RESPONSE ─────────────────────────────────────────────────────────────

export const existenciaNumeroSchema = z.object({ exists: z.boolean() });

// ─── TIPOS ────────────────────────────────────────────────────────────────

export type IndicarEscrituraInput = z.input<typeof indicarEscrituraInputSchema>;
export type VerificarExistenciaInput = z.input<typeof verificarExistenciaInputSchema>;
export type MarcarLeidoInput = z.input<typeof marcarLeidoInputSchema>;
export type CambiarPresenciaInput = z.input<typeof cambiarPresenciaInputSchema>;
export type ExistenciaNumero = z.infer<typeof existenciaNumeroSchema>;
