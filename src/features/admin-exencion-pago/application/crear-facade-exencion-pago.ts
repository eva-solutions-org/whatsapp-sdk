import type { HttpClient } from "../../../core/http-client/index.js";
import {
  alternarExencion,
  historialExencion,
  iterarHistorialExencion,
} from "./operaciones-exencion.js";

/** Exención de pagos de un User (bypass del cobro). */
export const crearFacadeExencionPago = (http: HttpClient) => ({
  /** Activa o revoca la exención. */
  alternar: alternarExencion(http),
  /** Historial de exenciones con paginación por cursor. */
  historial: historialExencion(http),
  /** Recorre todo el historial (async iterator). */
  iterarHistorial: iterarHistorialExencion(http),
});

export type FacadeExencionPago = ReturnType<typeof crearFacadeExencionPago>;
