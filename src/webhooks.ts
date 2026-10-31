/**
 * Subpath `@eva_solutions/whatsapp-sdk/webhooks`.
 *
 * Verificación de la firma HMAC-SHA256 (`X-Webhook-Signature`) de los webhooks de la API
 * y tipos de sus eventos. Aislado del barrel principal: quien no recibe webhooks no carga
 * WebCrypto.
 */

export {
  HEADER_FIRMA_WEBHOOK,
  verificarFirmaWebhook,
  verificarWebhookDesdeRequest,
} from "./features/webhooks/index.js";
export type { OpcionesVerificarRequest, VerificarFirmaInput } from "./features/webhooks/index.js";

export {
  ESTADOS_MENSAJE,
  TIPOS_EVENTO_WEBHOOK,
  TIPOS_MENSAJE,
  eventoWebhookSchema,
} from "./features/notificaciones/index.js";
export type {
  EstadoMensaje,
  EventoDesconocido,
  EventoMensaje,
  EventoWebhook,
  EventoWebhookRecibido,
  TipoEventoWebhook,
  TipoMensaje,
} from "./features/notificaciones/index.js";

export { ErrorConfiguracion } from "./core/errors/index.js";
export { esExitoso, esFallido } from "./core/types/index.js";
export type {
  CodigoErrorHttp,
  ErrorResultado,
  OrigenError,
  Resultado,
} from "./core/types/index.js";
