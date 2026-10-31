/** Contrato público del feature `internal-mensajes`. Los schemas Zod son internos. */

export { crearFacadeMensajesInternos } from "./application/index.js";
export type { FacadeMensajesInternos } from "./application/index.js";
export type {
  EnviarMediaInput,
  EnviarMensajeInput,
  EnviarTextoInput,
  MensajeEnviado,
} from "./domain/index.js";
