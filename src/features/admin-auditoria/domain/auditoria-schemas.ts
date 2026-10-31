import { z } from "zod";
import { fechaIsoSchema, paginacionSchema } from "../../../core/validacion/index.js";

export const listarLogsInputSchema = z.object({
  /** Filtra por id de API key. */
  apiKeyId: z.string().min(1).optional(),
  /** Inicio del rango (ISO 8601 UTC, p. ej. `2026-01-01T00:00:00Z`). */
  from: fechaIsoSchema.optional(),
  /** Fin del rango (ISO 8601 UTC). */
  to: fechaIsoSchema.optional(),
  /** Página, desde 1 (default de la API: 1). */
  page: z.number().int().positive().optional(),
  /** Resultados por página, 1 a 100 (default de la API: 50). */
  limit: z.number().int().positive().max(100).optional(),
});
export type ListarLogsInput = z.input<typeof listarLogsInputSchema>;

const logAuditoriaSchema = z.object({
  id: z.number(),
  apiKeyId: z.string().nullable(),
  ip: z.string(),
  endpoint: z.string(),
  method: z.string(),
  timestamp: z.string(),
});
export type LogAuditoria = z.infer<typeof logAuditoriaSchema>;

/** Respuesta `{ data, pagination }`: el core no la desenvuelve, el schema ve el JSON completo. */
export const listarLogsRespuestaSchema = z.object({
  data: z.array(logAuditoriaSchema),
  pagination: paginacionSchema,
});
export type ListarLogsRespuesta = z.infer<typeof listarLogsRespuestaSchema>;

const PERIODOS_USO = ["24h", "7d", "30d"] as const;

export const obtenerUsoInputSchema = z.object({
  apiKeyId: z.string().min(1),
  /** Default de la API: `24h`. */
  period: z.enum(PERIODOS_USO).optional(),
});
export type ObtenerUsoInput = z.input<typeof obtenerUsoInputSchema>;

export const usoApiKeySchema = z.object({
  period: z.string(),
  totalRequests: z.number(),
  requestsByEndpoint: z.record(z.string(), z.number()),
  requestsByMethod: z.record(z.string(), z.number()),
  uniqueIps: z.number(),
  topIps: z.array(
    z.object({
      ip: z.string(),
      requestCount: z.number(),
      lastSeen: z.string().nullable(),
    }),
  ),
  lastActivity: z.string().nullable(),
});
export type UsoApiKey = z.infer<typeof usoApiKeySchema>;
