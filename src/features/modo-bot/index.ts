export {
  CODIGO_NUMERO_SIN_WHATSAPP,
  CODIGO_VERIFICACION_NO_DISPONIBLE,
  aplicarModoBot,
  aplicarModoBotInterno,
} from "./application/index.js";
export type { CosturasModoBot, FacadeMensajesBot, OpcionesEnvioBot } from "./application/index.js";
export { resolverModoBot, resolverOpcionesBot } from "./domain/index.js";
export type {
  AdvertenciaBot,
  ConfigModoBot,
  OpcionesEscrituraBot,
  OpcionesModoBot,
  PoliticaFalloVerificacion,
} from "./domain/index.js";
