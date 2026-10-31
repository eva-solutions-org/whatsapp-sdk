import { z } from "zod";
import { idSchema } from "../../../core/validacion/index.js";

/** Id LOCAL del pago (cuid), no el id del procesador. */
export const pagoIdInputSchema = z.object({ id: idSchema });
export type PagoIdInput = z.input<typeof pagoIdInputSchema>;

/**
 * `local` es la fila del pago en la API y `pasarela` el detalle del procesador de pagos
 * (`null` si el pago aún no tiene id externo). Ambos con forma propia de esos servicios:
 * la API los documenta como opacos, por eso son `unknown`.
 */
export const pagoConsultadoSchema = z.object({
  local: z.unknown(),
  pasarela: z.unknown().nullable(),
});
export type PagoConsultado = z.infer<typeof pagoConsultadoSchema>;

export const pagoCancelacionSchema = z.object({
  id: z.string(),
  /** `cancelando` mientras el procesador confirma. */
  pasarelaStatus: z.string(),
});
export type PagoCancelacion = z.infer<typeof pagoCancelacionSchema>;

/** Hasta 8 enteros sin ceros a la izquierda y EXACTAMENTE 2 decimales (p. ej. `4.00`). */
const montoReembolsoSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,7})\.\d{2}$/, "Debe tener hasta 8 enteros y exactamente 2 decimales");

export const reembolsarPagoInputSchema = z.object({
  id: idSchema,
  /** Omitir para reembolso total. */
  monto: montoReembolsoSchema.optional(),
});
export type ReembolsarPagoInput = z.input<typeof reembolsarPagoInputSchema>;

export const pagoReembolsoSchema = z.object({
  id: z.string(),
  /** `reembolsando` mientras el procesador confirma. */
  pasarelaStatus: z.string(),
  estadoSdk: z.string(),
});
export type PagoReembolso = z.infer<typeof pagoReembolsoSchema>;
