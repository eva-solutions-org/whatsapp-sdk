/**
 * Schemas Zod del feature `programados` — espejo de `features/scheduling/domain/scheduling-schemas.ts`
 * de la API. Las fechas viajan como string ISO 8601.
 */

import { z } from "zod";
import { enumTolerante, paginacionSchema } from "../../../core/validacion/index.js";

const TIPOS_MENSAJE_PROGRAMADO = ["message", "image", "video", "pdf", "gif", "location"] as const;

const ESTADOS_MENSAJE_PROGRAMADO = [
  "pendiente",
  "procesando",
  "enviado",
  "fallido",
  "cancelado",
] as const;

// ─── INPUT ────────────────────────────────────────────────────────────────

/**
 * `payload` según el tipo: `message` → `{ message }`; `image|video|gif|pdf` → `{ url, caption }`;
 * `location` → `{ latitude, longitude }`. La API no lo valida por tipo al programar: un payload
 * incorrecto recién falla al enviarse (queda `fallido` con `mensajeError`).
 */
export const crearProgramadoInputSchema = z.object({
  destinatario: z.string().regex(/^[1-9][0-9]{6,14}$/, "Número de teléfono inválido"),
  tipo: z.enum(TIPOS_MENSAJE_PROGRAMADO),
  payload: z.record(z.string(), z.unknown()),
  programadoPara: z.iso.datetime(),
});

export const listarProgramadosInputSchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const idProgramadoSchema = z.number().int().min(1);

// ─── RESPONSE ─────────────────────────────────────────────────────────────

export const programadoResumenSchema = z.object({
  id: z.number(),
  destinatario: z.string(),
  tipo: enumTolerante(TIPOS_MENSAJE_PROGRAMADO),
  programadoPara: z.string(),
  estado: enumTolerante(ESTADOS_MENSAJE_PROGRAMADO),
  createdAt: z.string(),
});

export const programadoDetalleSchema = programadoResumenSchema.extend({
  payload: z.record(z.string(), z.unknown()),
  mensajeError: z.string().nullable(),
  intentos: z.number(),
  maxIntentos: z.number(),
});

export const listarProgramadosResponseSchema = z.object({
  data: z.array(programadoResumenSchema),
  pagination: paginacionSchema,
});

export const confirmacionProgramadoSchema = z.object({ message: z.string() });

// ─── TIPOS ────────────────────────────────────────────────────────────────

export type TipoMensajeProgramado = (typeof TIPOS_MENSAJE_PROGRAMADO)[number];
export type EstadoMensajeProgramado = (typeof ESTADOS_MENSAJE_PROGRAMADO)[number];
export type CrearProgramadoInput = z.input<typeof crearProgramadoInputSchema>;
export type ListarProgramadosInput = z.input<typeof listarProgramadosInputSchema>;
export type ProgramadoResumen = z.infer<typeof programadoResumenSchema>;
export type ProgramadoDetalle = z.infer<typeof programadoDetalleSchema>;
export type ListarProgramadosResponse = z.infer<typeof listarProgramadosResponseSchema>;
export type ConfirmacionProgramado = z.infer<typeof confirmacionProgramadoSchema>;
