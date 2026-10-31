/** Contrato público del feature `admin-pagos`. Los schemas Zod son internos. */

export { crearFacadePagosAdmin } from "./application/index.js";
export type { FacadePagosAdmin } from "./application/index.js";
export type {
  PagoCancelacion,
  PagoConsultado,
  PagoIdInput,
  PagoReembolso,
  ReembolsarPagoInput,
} from "./domain/index.js";
