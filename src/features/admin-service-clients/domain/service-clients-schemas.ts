import { z } from "zod";
import { telefonoSchema } from "../../../core/validacion/index.js";

/** Id interno del service client en Auth (uuid): es el `sub` de sus tokens. */
const idSchema = z.uuid();

/** Slug informativo del service client en Auth (`client_id` del token), 3 a 64 caracteres. */
const clientIdSchema = z.string().min(3).max(64);

// ── Respuestas ──

/**
 * Registro local de un service client en Whatsapp-api. No guarda secreto ni permisos: las
 * credenciales viven en Auth y los permisos viajan en el token.
 */
export const serviceClientSchema = z.object({
  /** `sub` del token: id interno estable del service client en Auth. */
  id: z.string(),
  /** Slug informativo (`client_id` del token): logs y UI, no identifica. */
  clientId: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  allowedSourcePhones: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ServiceClient = z.infer<typeof serviceClientSchema>;

/** Respuesta `{ data, nextCursor }`: el core no la desenvuelve, el schema ve el JSON completo. */
export const listaServiceClientsSchema = z.object({
  data: z.array(serviceClientSchema),
  nextCursor: z.string().nullable(),
});
export type ListaServiceClients = z.infer<typeof listaServiceClientsSchema>;

export const allowlistSchema = z.object({
  id: z.string(),
  allowedSourcePhones: z.array(z.string()),
});
export type Allowlist = z.infer<typeof allowlistSchema>;

// ── Entradas ──

export const crearServiceClientInputSchema = z.object({
  /** Id del service client en Auth (el `sub` de sus tokens). */
  id: idSchema,
  clientId: clientIdSchema,
  name: z.string().min(1).max(255),
  /** Default de la API: `true`. */
  enabled: z.boolean().optional(),
  /** Teléfonos remitentes permitidos en `./internal`. Default de la API: ninguno. */
  allowedSourcePhones: z.array(telefonoSchema).optional(),
});
export type CrearServiceClientInput = z.input<typeof crearServiceClientInputSchema>;

export const listarServiceClientsInputSchema = z.object({
  /** `nextCursor` de la página anterior. */
  cursor: z.string().min(1).optional(),
  /** 1 a 100 (default de la API: 20). */
  limit: z.number().int().min(1).max(100).optional(),
});
export type ListarServiceClientsInput = z.input<typeof listarServiceClientsInputSchema>;

export const idServiceClientInputSchema = z.object({ id: idSchema });
export type IdServiceClientInput = z.input<typeof idServiceClientInputSchema>;

export const actualizarServiceClientInputSchema = z.object({
  id: idSchema,
  clientId: clientIdSchema.optional(),
  name: z.string().min(1).max(255).optional(),
  enabled: z.boolean().optional(),
});
export type ActualizarServiceClientInput = z.input<typeof actualizarServiceClientInputSchema>;

export const telefonoOrigenInputSchema = z.object({
  id: idSchema,
  phone: telefonoSchema,
});
export type TelefonoOrigenInput = z.input<typeof telefonoOrigenInputSchema>;
