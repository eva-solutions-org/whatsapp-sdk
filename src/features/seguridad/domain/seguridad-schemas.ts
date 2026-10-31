import { z } from "zod";

/** Código de 6 dígitos enviado al administrador para verificar la IP. */
export const verificarIpInputSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "El código debe tener 6 dígitos"),
});

export const ipVerificadaSchema = z.object({
  message: z.string(),
  /** IP que quedó verificada. */
  ip: z.string(),
});

export type VerificarIpInput = z.input<typeof verificarIpInputSchema>;
export type IpVerificada = z.infer<typeof ipVerificadaSchema>;
