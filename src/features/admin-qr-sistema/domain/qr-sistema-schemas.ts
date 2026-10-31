import { z } from "zod";

/** Formatos JSON del QR; el PNG es binario y tiene su propia operación. */
const formatoQrSchema = z.enum(["raw", "base64"]);

export const obtenerQrInputSchema = z.object({
  /** `raw` (default de la API): texto del QR. `base64`: data URL de la imagen. */
  formato: formatoQrSchema.optional(),
});
export type ObtenerQrInput = z.input<typeof obtenerQrInputSchema>;

/**
 * `qr` viene ausente si la sesión del sistema ya está conectada; entonces `message` explica el
 * estado. `phone` es el teléfono del sistema.
 */
export const qrSistemaSchema = z.object({
  qr: z.string().optional(),
  message: z.string().optional(),
  phone: z.string(),
});
export type QrSistema = z.infer<typeof qrSistemaSchema>;
