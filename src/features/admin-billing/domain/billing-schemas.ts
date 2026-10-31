import { z } from "zod";
import {
  TIPOS_MOVIMIENTO,
  decimalNoNegativoSchema,
  decimalSchema,
  monedaSchema,
  paginacionSchema,
  telefonoSchema,
  idSchema,
} from "../../../core/validacion/index.js";

// ── Precios por moneda ──

export const precioMonedaSchema = z.object({
  id: z.number(),
  moneda: z.string(),
  costoPorMensaje: z.string(),
  activa: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PrecioMoneda = z.infer<typeof precioMonedaSchema>;

export const listaPreciosSchema = z.array(precioMonedaSchema);

export const crearPrecioInputSchema = z.object({
  moneda: monedaSchema,
  costoPorMensaje: decimalSchema,
});
export type CrearPrecioInput = z.input<typeof crearPrecioInputSchema>;

export const actualizarPrecioInputSchema = z.object({
  moneda: monedaSchema,
  costoPorMensaje: decimalSchema.optional(),
  activa: z.boolean().optional(),
});
export type ActualizarPrecioInput = z.input<typeof actualizarPrecioInputSchema>;

export const desactivarPrecioInputSchema = z.object({ moneda: monedaSchema });
export type DesactivarPrecioInput = z.input<typeof desactivarPrecioInputSchema>;

// ── Ajuste de saldo de un usuario ──

/** Monto con signo y hasta 4 decimales (`decimalAjusteSchema` de la API). */
const montoAjusteSchema = z
  .string()
  .regex(/^-?\d+(\.\d{1,4})?$/, "Debe ser un número decimal válido (con signo, hasta 4 decimales)");

export const ajustarSaldoInputSchema = z.object({
  /** Id del User (no de la API key). */
  userId: idSchema,
  /** Positivo acredita, negativo debita. Hasta 4 decimales. */
  monto: montoAjusteSchema,
  /** Debe ser la moneda del User: el monto no se convierte (400 si no coincide). */
  moneda: z.string().length(3),
  /** Motivo para auditoría, 10 a 500 caracteres. */
  descripcion: z.string().min(10).max(500),
  /** `true` permite superar el cap admin (`BILLING_AJUSTE_ADMIN_CAP_USD`) o dejar saldo negativo. */
  forzar: z.boolean().optional(),
});
export type AjustarSaldoInput = z.input<typeof ajustarSaldoInputSchema>;

export const ajusteSaldoSchema = z.object({ balance: z.string() });
export type AjusteSaldo = z.infer<typeof ajusteSaldoSchema>;

// ── Cambio de moneda ──

export const cambiarMonedaInputSchema = z.object({
  /** Teléfono de una API key del User dueño. */
  phone: telefonoSchema,
  /** Moneda que se espera que tenga el User ahora (409 si ya cambió). */
  monedaActual: monedaSchema,
  nuevaMoneda: monedaSchema,
  /** Unidades de la moneda nueva por 1 unidad de la actual. */
  tasaConversion: z.number().positive(),
});
export type CambiarMonedaInput = z.input<typeof cambiarMonedaInputSchema>;

export const cambioMonedaSchema = z.object({
  balanceAnterior: z.string(),
  monedaAnterior: z.string(),
  balanceNuevo: z.string(),
  costoPorMensajeAnterior: z.string(),
  costoPorMensajeNuevo: z.string(),
  monedaNueva: z.string(),
  movimientoId: z.number(),
});
export type CambioMoneda = z.infer<typeof cambioMonedaSchema>;

// ── Configuración de billing por API key ──

export const configurarBillingInputSchema = z.object({
  phone: telefonoSchema,
  costoPorMensaje: decimalNoNegativoSchema.optional(),
  mensajesGratisPorMes: z.number().int().nonnegative().optional(),
  recibirEntrantes: z.boolean().optional(),
  umbralSaldoBajo: decimalNoNegativoSchema.optional(),
});
export type ConfigurarBillingInput = z.input<typeof configurarBillingInputSchema>;

/** `message` más los campos que la API echo-ea (los que se enviaron). */
export const configuracionBillingSchema = z.object({ message: z.string() }).catchall(z.unknown());
export type ConfiguracionBilling = z.infer<typeof configuracionBillingSchema>;

// ── Movimientos ──

export const listarMovimientosInputSchema = z.object({
  phone: telefonoSchema,
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  tipo: z.enum(TIPOS_MOVIMIENTO).optional(),
});
export type ListarMovimientosInput = z.input<typeof listarMovimientosInputSchema>;

const movimientoBillingSchema = z.object({
  id: z.number(),
  tipo: z.string(),
  monto: z.string(),
  moneda: z.string(),
  balanceAnterior: z.string(),
  balanceNuevo: z.string(),
  descripcion: z.string().nullable(),
  referencia: z.string().nullable(),
  createdAt: z.string(),
});
export type MovimientoBilling = z.infer<typeof movimientoBillingSchema>;

/** Respuesta `{ data, pagination }`: el core no la desenvuelve, el schema ve el JSON completo. */
export const listarMovimientosRespuestaSchema = z.object({
  data: z.array(movimientoBillingSchema),
  pagination: paginacionSchema,
});
export type ListarMovimientosRespuesta = z.infer<typeof listarMovimientosRespuestaSchema>;
