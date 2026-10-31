/** Contrato público del feature `admin-exencion-pago`. Los schemas Zod son internos. */

export { crearFacadeExencionPago } from "./application/index.js";
export type { FacadeExencionPago } from "./application/index.js";
export type {
  AlternarExencionInput,
  Exencion,
  ExencionAplicada,
  HistorialExencion,
  HistorialExencionInput,
} from "./domain/index.js";
