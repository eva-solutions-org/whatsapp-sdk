/**
 * Schemas Zod del feature `billing` — espejo de `features/billing/domain/billing-schemas.ts`
 * de la API (endpoints `/v1/me/billing/*`). Los montos son strings decimales.
 */

import { z } from "zod";
import {
  TIPOS_MOVIMIENTO,
  decimalSchema,
  enumTolerante,
  paginacionSchema,
} from "../../../core/validacion/index.js";

const ESTADOS_PAGO_RECARGA = [
  "pendiente",
  "procesando",
  "completado",
  "fallido",
  "expirado",
  "reembolsado",
  "reembolsando",
  "cancelado",
  "cancelando",
] as const;

const FASES_GRACIA = ["normal", "fase_1", "fase_2", "fase_3"] as const;

// ─── INPUT ────────────────────────────────────────────────────────────────

export const listarMovimientosInputSchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  tipo: z.enum(TIPOS_MOVIMIENTO).optional(),
});

/** Hasta 8 enteros sin ceros a la izquierda y exactamente 2 decimales (ej. `"50.00"`). */
export const crearRecargaInputSchema = z.object({
  monto: z.string().regex(/^(?:0|[1-9]\d{0,7})\.\d{2}$/, "Formato esperado: 50.00"),
});

/** La API rechaza (400) un body sin `umbralSaldoBajo`, así que aquí es obligatorio. */
export const actualizarConfiguracionInputSchema = z.object({
  umbralSaldoBajo: decimalSchema,
});

export const idRecargaSchema = z.string().min(1);

// ─── RESPONSE ─────────────────────────────────────────────────────────────

export const balanceSchema = z.object({
  balance: z.string(),
  moneda: z.string(),
  costoPorMensaje: z.string(),
  mensajesGratisRestantes: z.number(),
  mensajesGratisPorMes: z.number(),
  faseGracia: z.object({
    fase: enumTolerante(FASES_GRACIA),
    puedeEnviar: z.boolean(),
    puedeRecibir: z.boolean(),
    horasEnGracia: z.number().nullable(),
  }),
  umbralSaldoBajo: z.string(),
  saldoBajo: z.boolean(),
});

const movimientoSchema = z.object({
  id: z.number(),
  tipo: enumTolerante(TIPOS_MOVIMIENTO),
  monto: z.string(),
  moneda: z.string(),
  balanceAnterior: z.string(),
  balanceNuevo: z.string(),
  descripcion: z.string().nullable(),
  referencia: z.string().nullable(),
  /** La API lo devuelve aunque su doc OpenAPI no lo declara. */
  apiKeyId: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const listarMovimientosResponseSchema = z.object({
  data: z.array(movimientoSchema),
  pagination: paginacionSchema,
});

/**
 * Recarga. `crearRecarga` (201) trae además link/QR/expiración; `obtenerRecarga` solo
 * `pagoId`, `monto`, `moneda` y `estado`.
 */
export const recargaSchema = z.object({
  pagoId: z.string(),
  monto: z.string(),
  moneda: z.string(),
  estado: enumTolerante(ESTADOS_PAGO_RECARGA),
  paymentLink: z.string().nullable().optional(),
  qrCodeUrl: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

export const configuracionActualizadaSchema = z.object({
  message: z.string(),
  umbralSaldoBajo: z.string().optional(),
});

// ─── TIPOS ────────────────────────────────────────────────────────────────

export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];
export type EstadoPagoRecarga = (typeof ESTADOS_PAGO_RECARGA)[number];
export type FaseGracia = (typeof FASES_GRACIA)[number];
export type ListarMovimientosInput = z.input<typeof listarMovimientosInputSchema>;
export type CrearRecargaInput = z.input<typeof crearRecargaInputSchema>;
export type ActualizarConfiguracionBillingInput = z.input<
  typeof actualizarConfiguracionInputSchema
>;
export type BalanceBilling = z.infer<typeof balanceSchema>;
export type MovimientoBilling = z.infer<typeof movimientoSchema>;
export type ListarMovimientosResponse = z.infer<typeof listarMovimientosResponseSchema>;
export type Recarga = z.infer<typeof recargaSchema>;
export type ConfiguracionBillingActualizada = z.infer<typeof configuracionActualizadaSchema>;
