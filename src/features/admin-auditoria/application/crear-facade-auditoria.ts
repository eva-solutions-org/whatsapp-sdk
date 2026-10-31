import type { HttpClient } from "../../../core/http-client/index.js";
import { iterarLogs, listarLogs } from "./listar-logs.js";
import { obtenerUso } from "./obtener-uso.js";

/** Logs de auditoría y analítica de uso por API key. */
export const crearFacadeAuditoria = (http: HttpClient) => ({
  /** Lista paginada de logs de auditoría, con filtros opcionales. */
  listarLogs: listarLogs(http),
  /** Recorre todos los logs (async iterator). */
  iterarLogs: iterarLogs(http),
  /** Estadísticas de uso de una API key en un periodo (`24h`, `7d` o `30d`). */
  obtenerUso: obtenerUso(http),
});

export type FacadeAuditoria = ReturnType<typeof crearFacadeAuditoria>;
