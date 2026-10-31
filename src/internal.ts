/**
 * Subpath `@eva_solutions/whatsapp-sdk/internal`: envío interno de mensajes
 * (`/v1/internal/*`), firmado con HMAC S2S de un service client.
 *
 * ```ts
 * const interno = crearClienteInterno({ baseUrl, clientId, secretoHex });
 * const r = await interno.mensajes.enviar({ phone, message, sourcePhone });
 * ```
 *
 * Solo HMAC S2S (headers `X-Eva-*`). La API acepta también un JWT de servicio en
 * `Authorization: Bearer`, pero ese camino es exclusivo de Auth - API y este SDK no lo
 * implementa. Los POST no se reintentan (nonce de un solo uso).
 */

import { crearHttpClientS2S } from "./core/cliente/index.js";
import type { OpcionesClienteS2S } from "./core/cliente/index.js";
import { crearFacadeMensajesInternos } from "./features/internal-mensajes/index.js";
import type { FacadeMensajesInternos } from "./features/internal-mensajes/index.js";

/** Cliente `./internal`. */
export interface ClienteInterno {
  readonly mensajes: FacadeMensajesInternos;
}

/**
 * Crea el cliente interno.
 *
 * `secretoHex` es el secreto del service client (hex); nunca aparece en mensajes de error.
 *
 * @throws {ErrorConfiguracion} `clientId`, `secretoHex`, `baseUrl`, `timeout` o `reintentos`
 *   inválidos (error de programación, no flujo de negocio).
 */
export const crearClienteInterno = (opciones: OpcionesClienteS2S): ClienteInterno => ({
  mensajes: crearFacadeMensajesInternos(crearHttpClientS2S(opciones)),
});

export { crearHttpClientS2S } from "./core/cliente/index.js";
export type { OpcionesClienteS2S } from "./core/cliente/index.js";
export type { HttpClient } from "./core/http-client/index.js";
export { ErrorConfiguracion } from "./core/errors/index.js";
export { esExitoso, esFallido } from "./core/types/index.js";
export type {
  CodigoErrorHttp,
  ErrorResultado,
  OrigenError,
  Resultado,
} from "./core/types/index.js";
export type { OpcionesOperacion } from "./core/validacion/index.js";

export type { FacadeMensajesInternos } from "./features/internal-mensajes/index.js";
export type {
  EnviarMediaInput,
  EnviarMensajeInput,
  EnviarTextoInput,
  MensajeEnviado,
} from "./features/internal-mensajes/index.js";
