/**
 * Entry point principal de `@eva_solutions/whatsapp-sdk` (superficie `x-api-key`).
 *
 * Subpaths separados (cada uno con su entry):
 * - `/webhooks`: verificación de firma y eventos de webhook.
 * - `/ws`: cliente WebSocket de eventos en tiempo real.
 * - `/admin`: cliente de administración (firma S2S).
 * - `/internal`: envío interno de mensajes (firma S2S).
 */

// Cliente
export { crearCliente } from "./core/cliente/index.js";
export type {
  ClienteWhatsapp,
  OpcionesBaseCliente,
  OpcionesCliente,
} from "./core/cliente/index.js";
export type { OpcionesReintentos, RespuestaBinaria } from "./core/http-client/index.js";
export type { OpcionesOperacion } from "./core/validacion/index.js";

// Error de configuración (único throw síncrono del SDK)
export { ErrorConfiguracion } from "./core/errors/index.js";

// Result Pattern
export { esExitoso, esFallido } from "./core/types/index.js";
export type {
  CodigoErrorHttp,
  ErrorResultado,
  OrigenError,
  Resultado,
} from "./core/types/index.js";

// Tipos públicos de cada feature (el index.ts de cada feature exporta nombres únicos)
export type * from "./features/mensajes/index.js";
export type * from "./features/sesion/index.js";
export type * from "./features/programados/index.js";
export type * from "./features/webhooks-fallidos/index.js";
export type * from "./features/buffer-ws/index.js";
export type * from "./features/billing/index.js";
export type * from "./features/seguridad/index.js";
export type * from "./features/webhook-secret/index.js";
