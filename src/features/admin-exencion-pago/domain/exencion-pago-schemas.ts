import { z } from "zod";
import { fechaIsoSchema, idSchema } from "../../../core/validacion/index.js";

export const alternarExencionInputSchema = z.object({
  /** Id del User (no de la API key). */
  userId: idSchema,
  /** `true` activa la exención de pagos; `false` la revoca. */
  exempt: z.boolean(),
  /** Motivo para auditoría, 10 a 500 caracteres. */
  reason: z.string().min(10).max(500),
  /** Vencimiento ISO 8601 UTC. Omitido = permanente. Solo aplica con `exempt: true`. */
  expiresAt: fechaIsoSchema.optional(),
});
export type AlternarExencionInput = z.input<typeof alternarExencionInputSchema>;

const exencionSchema = z.object({
  id: z.number(),
  exempt: z.boolean(),
  expiresAt: z.string().nullable(),
  reason: z.string(),
  ip: z.string(),
  createdAt: z.string(),
});
export type Exencion = z.infer<typeof exencionSchema>;

export const exencionAplicadaSchema = z.object({
  userId: z.string(),
  exencion: exencionSchema,
});
export type ExencionAplicada = z.infer<typeof exencionAplicadaSchema>;

export const historialExencionInputSchema = z.object({
  userId: idSchema,
  /** 1 a 100 (default de la API: 20). */
  limit: z.number().int().min(1).max(100).optional(),
  /** `pagination.nextCursor` de la página anterior (opaco). */
  cursor: z.string().min(1).optional(),
  desde: fechaIsoSchema.optional(),
  hasta: fechaIsoSchema.optional(),
  /** `true` solo exenciones, `false` solo revocaciones. */
  exempt: z.boolean().optional(),
  /** `true` devuelve solo la última fila e ignora el resto de los filtros. */
  soloVigente: z.boolean().optional(),
});
export type HistorialExencionInput = z.input<typeof historialExencionInputSchema>;

/**
 * Rareza de la API: esta respuesta NO usa el envelope `{ data }`; es `{ items, pagination }`
 * con paginación por cursor (no `page`/`total`).
 */
export const historialExencionSchema = z.object({
  items: z.array(exencionSchema.extend({ userId: z.string() })),
  pagination: z.object({
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
    limit: z.number(),
  }),
});
export type HistorialExencion = z.infer<typeof historialExencionSchema>;
