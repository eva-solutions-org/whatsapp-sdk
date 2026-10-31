import type { HttpClient } from "../../core/http-client/index.js";
import {
  actualizarConfiguracion,
  crearRecarga,
  iterarMovimientos,
  listarMovimientos,
  obtenerBalance,
  obtenerRecarga,
} from "./application/billing-operaciones.js";

/** Saldo, movimientos y recargas del usuario (`/v1/me/billing/*`). */
export const crearFacadeBilling = (http: HttpClient) => {
  return {
    obtenerBalance: obtenerBalance(http),
    listarMovimientos: listarMovimientos(http),
    iterarMovimientos: iterarMovimientos(http),
    crearRecarga: crearRecarga(http),
    obtenerRecarga: obtenerRecarga(http),
    actualizarConfiguracion: actualizarConfiguracion(http),
  };
};

export type FacadeBilling = ReturnType<typeof crearFacadeBilling>;

export type {
  ActualizarConfiguracionBillingInput,
  BalanceBilling,
  ConfiguracionBillingActualizada,
  CrearRecargaInput,
  EstadoPagoRecarga,
  FaseGracia,
  ListarMovimientosInput,
  ListarMovimientosResponse,
  MovimientoBilling,
  Recarga,
  TipoMovimiento,
} from "./domain/billing-schemas.js";
