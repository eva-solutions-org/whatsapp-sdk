import type { HttpClient } from "../../../core/http-client/index.js";
import { cancelarPago, obtenerPago, reembolsarPago } from "./operaciones-pago.js";

/**
 * Pagos de recarga (administración). No incluye `/webhook/pagos`: es el webhook entrante del
 * procesador de pagos, autenticado con su propia firma, no una operación admin.
 */
export const crearFacadePagosAdmin = (http: HttpClient) => ({
  /** Pago local enriquecido con el detalle del procesador. */
  obtener: obtenerPago(http),
  /** Solicita la cancelación al procesador (estado intermedio `cancelando`). */
  cancelar: cancelarPago(http),
  /** Solicita un reembolso total o parcial (estado intermedio `reembolsando`). */
  reembolsar: reembolsarPago(http),
});

export type FacadePagosAdmin = ReturnType<typeof crearFacadePagosAdmin>;
