/**
 * Subpath `@eva_solutions/whatsapp-sdk/ws`: cliente WebSocket de eventos en tiempo real
 * (autenticado con x-api-key en `Sec-WebSocket-Protocol`).
 *
 * Usa el `WebSocket` global (Node >= 22, navegadores, Bun, Deno); para runtimes sin él o tests
 * inyecta `webSocketImpl`.
 */

export { CODIGOS_CIERRE_SIN_RECONEXION, conectarWs } from "./features/ws/index.js";
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
} from "./features/ws/index.js";

export { ErrorConfiguracion } from "./core/errors/index.js";
export { esExitoso, esFallido } from "./core/types/index.js";
export type {
  CodigoErrorHttp,
  ErrorResultado,
  OrigenError,
  Resultado,
} from "./core/types/index.js";

export {
  ESTADOS_MENSAJE,
  SUBTIPOS_ALERTA_BILLING,
  TIPOS_EVENTO_NOTIFICACION,
  TIPOS_MENSAJE,
  eventoNotificacionSchema,
} from "./features/notificaciones/index.js";
export type {
  EstadoMensaje,
  EventoDesconocido,
  EventoMensaje,
  EventoNotificacion,
  EventoNotificacionRecibido,
  SubtipoAlertaBilling,
  TipoEventoNotificacion,
  TipoMensaje,
} from "./features/notificaciones/index.js";
