import { z } from "zod";
import { telefonoSchema } from "../../../core/validacion/index.js";

/** Slug único del service client (kebab-case, 3 a 64 caracteres). */
const slugSchema = z.string().min(3).max(64);

const scopesSchema = z.array(z.string().min(1));

// ── Respuestas ──

export const serviceClientSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  scopes: z.array(z.string()),
  lastUsedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ServiceClient = z.infer<typeof serviceClientSchema>;

/** Solo en la creación: `secret` (hex en texto plano) no se vuelve a exponer. */
export const serviceClientCreadoSchema = serviceClientSchema.extend({ secret: z.string() });
export type ServiceClientCreado = z.infer<typeof serviceClientCreadoSchema>;

/** Respuesta `{ data, nextCursor }`: el core no la desenvuelve, el schema ve el JSON completo. */
export const listaServiceClientsSchema = z.object({
  data: z.array(serviceClientSchema),
  nextCursor: z.string().nullable(),
});
export type ListaServiceClients = z.infer<typeof listaServiceClientsSchema>;

export const secretRotadoSchema = z.object({
  slug: z.string(),
  /** Nuevo secret en texto plano. Es la única vez que se expone; el anterior ya no sirve. */
  secret: z.string(),
  rotatedAt: z.string(),
});
export type SecretRotado = z.infer<typeof secretRotadoSchema>;

export const allowlistSchema = z.object({
  slug: z.string(),
  allowedSourcePhones: z.array(z.string()),
});
export type Allowlist = z.infer<typeof allowlistSchema>;

// ── Entradas ──

export const crearServiceClientInputSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(255),
  /** Al menos uno, p. ej. `messages:send:text`, `messages:send:media`, `admin`. */
  scopes: scopesSchema.min(1),
  /** Default de la API: `true`. */
  enabled: z.boolean().optional(),
});
export type CrearServiceClientInput = z.input<typeof crearServiceClientInputSchema>;

export const listarServiceClientsInputSchema = z.object({
  /** `nextCursor` de la página anterior. */
  cursor: z.string().min(1).optional(),
  /** 1 a 100 (default de la API: 20). */
  limit: z.number().int().min(1).max(100).optional(),
});
export type ListarServiceClientsInput = z.input<typeof listarServiceClientsInputSchema>;

export const slugInputSchema = z.object({ slug: slugSchema });
export type SlugInput = z.input<typeof slugInputSchema>;

export const actualizarServiceClientInputSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(255).optional(),
  scopes: scopesSchema.optional(),
  enabled: z.boolean().optional(),
});
export type ActualizarServiceClientInput = z.input<typeof actualizarServiceClientInputSchema>;

export const telefonoOrigenInputSchema = z.object({
  slug: slugSchema,
  phone: telefonoSchema,
});
export type TelefonoOrigenInput = z.input<typeof telefonoOrigenInputSchema>;
