import { z } from "zod";

/**
 * Los dos cuerpos son `strictObject`: la API los evalúa como unión y, con un body que trae
 * `message` Y `mediaUrl`, enviaría el texto en silencio ignorando la media. Aquí se rechaza.
 */
const enviarTextoInputSchema = z.strictObject({
  /** Destino (E.164 sin `+`), 7 a 20 caracteres. */
  phone: z.string().min(7).max(20),
  /** Texto, 1 a 4096 caracteres. */
  message: z.string().min(1).max(4096),
  /** Número remitente: debe estar en la allowlist del service client y tener sesión vinculada. */
  sourcePhone: z.string().min(7).max(20),
});
export type EnviarTextoInput = z.input<typeof enviarTextoInputSchema>;

const TIPOS_MEDIA = ["image", "video", "audio", "document"] as const;

const enviarMediaInputSchema = z.strictObject({
  phone: z.string().min(7).max(20),
  sourcePhone: z.string().min(7).max(20),
  /** URL pública del archivo. */
  mediaUrl: z.url(),
  /** Leyenda opcional, hasta 1024 caracteres. */
  caption: z.string().max(1024).optional(),
  mediaType: z.enum(TIPOS_MEDIA),
});
export type EnviarMediaInput = z.input<typeof enviarMediaInputSchema>;

export const enviarMensajeInputSchema = z.union([enviarTextoInputSchema, enviarMediaInputSchema]);
export type EnviarMensajeInput = EnviarTextoInput | EnviarMediaInput;

/** `{ message: "Mensaje enviado" }` (ya desenvuelto de `{ data }`). */
export const mensajeEnviadoSchema = z.object({ message: z.string() });
export type MensajeEnviado = z.infer<typeof mensajeEnviadoSchema>;
