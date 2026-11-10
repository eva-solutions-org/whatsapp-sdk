/** Contrato público del feature `internal-chats`. Los schemas Zod son internos. */

export { crearFacadeChatsInternos } from "./application/index.js";
export type { FacadeChatsInternos } from "./application/index.js";
export { esTelefonoInterno } from "./domain/index.js";
export type {
  ExistenciaNumeroInterno,
  IndicarEscrituraInternoInput,
  VerificarExistenciaInternoInput,
} from "./domain/index.js";
