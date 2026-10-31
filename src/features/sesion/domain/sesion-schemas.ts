import { z } from "zod";

/** Formatos JSON del QR. `png` se pide por separado (`obtenerQrPng`): responde binario. */
export const obtenerQrInputSchema = z.object({
  format: z.enum(["raw", "base64"]).optional(),
});

/** `{ qr }`: el string del QR (`raw`) o un data URL PNG (`base64`). */
export const qrSchema = z.object({ qr: z.string() });

export type ObtenerQrInput = z.input<typeof obtenerQrInputSchema>;
export type QrSesion = z.infer<typeof qrSchema>;
