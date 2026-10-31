/**
 * Contrato público del feature `ws`: cliente WebSocket de eventos en tiempo real.
 */
export { conectarWs } from "./application/index.js";
export { CODIGOS_CIERRE_SIN_RECONEXION } from "./domain/index.js";
export type {
  ClienteWs,
  ConstructorWebSocket,
  ErrorWs,
  EscuchaWs,
  InfoAperturaWs,
  InfoCierreWs,
  MapaEventosWs,
  MotivoErrorWs,
  NombreEventoWs,
  OpcionesConectarWs,
  OpcionesReconexion,
  WebSocketLike,
} from "./domain/index.js";
