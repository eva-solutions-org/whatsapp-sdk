/**
 * Schemas Zod del feature `mensajes` — espejo de `features/whatsapp/domain/send-schemas.ts`
 * de la API (Whatsapp-api). Los nombres de campo son los del contrato de la API.
 *
 * Los endpoints de media (`image`, `video`, `pdf`, `gif`) solo documentan y validan
 * `multipart/form-data`: un body JSON se interpreta como un form vacío y devuelve 422. Por eso
 * el SDK siempre envía media como multipart, tanto con `url` como con `file`.
 */

import { z } from "zod";

const telefonoSchema = z.string().regex(/^[1-9][0-9]{6,14}$/, "Número de teléfono inválido");

// ─── INPUT ────────────────────────────────────────────────────────────────

export const enviarTextoInputSchema = z.object({
  phone: telefonoSchema,
  message: z.string().min(1).max(100_000),
});

export const enviarUbicacionInputSchema = z.object({
  phone: telefonoSchema,
  latitude: z.number(),
  longitude: z.number(),
});

export const enviarLoteInputSchema = z.object({
  destinatarios: z.array(telefonoSchema).min(1).max(500),
  mensaje: z.string().min(1).max(5000),
});

/**
 * Archivo en memoria. La API valida `file.type` contra los MIME permitidos del tipo de media,
 * así que sin `tipoContenido` el envío siempre falla: por eso es obligatorio.
 */
const archivoBytesSchema = z.object({
  bytes: z.instanceof(Uint8Array),
  tipoContenido: z.string().min(1),
  nombre: z.string().min(1).optional(),
});

const archivoSchema = z.union([z.instanceof(Blob), archivoBytesSchema]);

const camposMedia = {
  phone: telefonoSchema,
  url: z.url().optional(),
  file: archivoSchema.optional(),
  caption: z.string().max(10_000).optional(),
};

const tieneUnSoloOrigen = (data: { url?: string | undefined; file?: unknown }): boolean =>
  (data.url !== undefined) !== (data.file !== undefined);

const MENSAJE_ORIGEN = "Debe proporcionar url o file, y no ambos";

/** Imagen, video o gif: `phone` + (`url` | `file`) + `caption` opcional. */
export const enviarMediaInputSchema = z
  .object(camposMedia)
  .refine(tieneUnSoloOrigen, { message: MENSAJE_ORIGEN });

export const enviarPdfInputSchema = z
  .object({ ...camposMedia, fileName: z.string().max(500).optional() })
  .refine(tieneUnSoloOrigen, { message: MENSAJE_ORIGEN });

// ─── RESPONSE ─────────────────────────────────────────────────────────────

/** Confirmación `{ message }` de los endpoints de envío (p. ej. "imagen enviado"). */
export const confirmacionEnvioSchema = z.object({ message: z.string() });

export const resultadoLoteSchema = z.object({
  totalEnviados: z.number(),
  totalFallidos: z.number(),
  resultados: z.array(
    z.object({
      destinatario: z.string(),
      exito: z.boolean(),
      error: z.string().optional(),
    }),
  ),
});

// ─── TIPOS ────────────────────────────────────────────────────────────────

export type EnviarTextoInput = z.input<typeof enviarTextoInputSchema>;
export type EnviarUbicacionInput = z.input<typeof enviarUbicacionInputSchema>;
export type EnviarLoteInput = z.input<typeof enviarLoteInputSchema>;
export type EnviarMediaInput = z.input<typeof enviarMediaInputSchema>;
export type EnviarPdfInput = z.input<typeof enviarPdfInputSchema>;
export type ArchivoMediaBytes = z.input<typeof archivoBytesSchema>;
export type ConfirmacionEnvio = z.infer<typeof confirmacionEnvioSchema>;
export type ResultadoLote = z.infer<typeof resultadoLoteSchema>;
