import type { HttpClient } from "../../../core/http-client/index.js";
import { ajustarSaldo } from "./ajustar-saldo.js";
import { cambiarMoneda } from "./cambiar-moneda.js";
import { configurarBilling } from "./configurar-billing.js";
import { iterarMovimientos, listarMovimientos } from "./listar-movimientos.js";
import { actualizarPrecio, crearPrecio, desactivarPrecio, listarPrecios } from "./precios.js";

/** Billing (administración): precios, saldo, moneda, configuración y movimientos. */
export const crearFacadeBillingAdmin = (http: HttpClient) => ({
  /** Precios por moneda. */
  precios: {
    listar: listarPrecios(http),
    crear: crearPrecio(http),
    actualizar: actualizarPrecio(http),
    /** Soft delete: marca la moneda como inactiva. */
    desactivar: desactivarPrecio(http),
  },
  /** Acredita o debita el saldo de un User (por `userId`). Requiere `descripcion`. */
  ajustarSaldo: ajustarSaldo(http),
  /** Cambia la moneda del User dueño de una API key (por teléfono) convirtiendo sus montos. */
  cambiarMoneda: cambiarMoneda(http),
  /** Configura costo por mensaje, cuota gratis, entrantes y umbral de una API key. */
  configurar: configurarBilling(http),
  /** Movimientos de billing de una API key (por teléfono), paginados. */
  listarMovimientos: listarMovimientos(http),
  /** Recorre todos los movimientos (async iterator). */
  iterarMovimientos: iterarMovimientos(http),
});

export type FacadeBillingAdmin = ReturnType<typeof crearFacadeBillingAdmin>;
