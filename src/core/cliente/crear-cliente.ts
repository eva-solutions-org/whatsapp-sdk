import { crearFacadeBilling } from "../../features/billing/index.js";
import type { FacadeBilling } from "../../features/billing/index.js";
import { crearFacadeBufferWs } from "../../features/buffer-ws/index.js";
import type { FacadeBufferWs } from "../../features/buffer-ws/index.js";
import { crearFacadeMensajes } from "../../features/mensajes/index.js";
import type { FacadeMensajes } from "../../features/mensajes/index.js";
import { crearFacadeProgramados } from "../../features/programados/index.js";
import type { FacadeProgramados } from "../../features/programados/index.js";
import { crearFacadeSeguridad } from "../../features/seguridad/index.js";
import type { FacadeSeguridad } from "../../features/seguridad/index.js";
import { crearFacadeSesion } from "../../features/sesion/index.js";
import type { FacadeSesion } from "../../features/sesion/index.js";
import { crearFacadeWebhookSecret } from "../../features/webhook-secret/index.js";
import type { FacadeWebhookSecret } from "../../features/webhook-secret/index.js";
import { crearFacadeWebhooksFallidos } from "../../features/webhooks-fallidos/index.js";
import type { FacadeWebhooksFallidos } from "../../features/webhooks-fallidos/index.js";
import { ErrorConfiguracion } from "../errors/index.js";
import { autenticadorApiKey } from "../http-client/index.js";
import { construirHttpClient } from "./construir-http-client.js";
import type { OpcionesBaseCliente } from "./construir-http-client.js";

/**
 * Opciones de `crearCliente`: las comunes (`OpcionesBaseCliente`) más `apiKey`
 * (string no vacío; se envía como `x-api-key` y NUNCA aparece en mensajes de error).
 */
export interface OpcionesCliente extends OpcionesBaseCliente {
  apiKey: string;
}

/** Cliente de la API pública (x-api-key): un namespace por feature. */
export interface ClienteWhatsapp {
  readonly mensajes: FacadeMensajes;
  readonly sesion: FacadeSesion;
  readonly programados: FacadeProgramados;
  readonly webhooksFallidos: FacadeWebhooksFallidos;
  readonly bufferWs: FacadeBufferWs;
  readonly billing: FacadeBilling;
  readonly seguridad: FacadeSeguridad;
  readonly webhookSecret: FacadeWebhookSecret;
}

/**
 * Factory principal del SDK (superficie `.`, autenticada con `x-api-key`).
 *
 * @throws {ErrorConfiguracion} Si `apiKey`, `baseUrl`, `timeout` o `reintentos` son
 *   inválidos. Son las ÚNICAS excepciones: error de programación, no flujo de negocio.
 *   Los mensajes NUNCA incluyen el valor de `apiKey` ni de `baseUrl`.
 */
export const crearCliente = (opciones: OpcionesCliente): ClienteWhatsapp => {
  if (
    opciones === null ||
    opciones === undefined ||
    typeof opciones !== "object" ||
    typeof opciones.apiKey !== "string" ||
    opciones.apiKey.length === 0
  ) {
    throw new ErrorConfiguracion("apiKey es requerido y debe ser string no vacío");
  }

  const http = construirHttpClient(opciones, autenticadorApiKey(opciones.apiKey));

  return {
    mensajes: crearFacadeMensajes(http),
    sesion: crearFacadeSesion(http),
    programados: crearFacadeProgramados(http),
    webhooksFallidos: crearFacadeWebhooksFallidos(http),
    bufferWs: crearFacadeBufferWs(http),
    billing: crearFacadeBilling(http),
    seguridad: crearFacadeSeguridad(http),
    webhookSecret: crearFacadeWebhookSecret(http),
  };
};
