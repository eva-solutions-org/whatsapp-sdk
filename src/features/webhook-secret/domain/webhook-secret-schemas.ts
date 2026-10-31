import { z } from "zod";

/**
 * La API NUNCA devuelve el secreto por HTTP: lo envía por WhatsApp al teléfono de la API key
 * y responde solo una confirmación.
 */
export const envioWebhookSecretSchema = z.object({ message: z.string() });

export type EnvioWebhookSecret = z.infer<typeof envioWebhookSecretSchema>;
