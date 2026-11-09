import { crearFacadeBilling } from "../../features/billing/index.js";
import type { FacadeBilling } from "../../features/billing/index.js";
import { crearFacadeBufferWs } from "../../features/buffer-ws/index.js";
import type { FacadeBufferWs } from "../../features/buffer-ws/index.js";
import { crearFacadeChats } from "../../features/chats/index.js";
import type { FacadeChats } from "../../features/chats/index.js";
import { crearFacadeMensajes } from "../../features/mensajes/index.js";
import { aplicarModoBot, resolverOpcionesBot } from "../../features/modo-bot/index.js";
import type { FacadeMensajesBot, OpcionesModoBot } from "../../features/modo-bot/index.js";
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
 *
 * - `modo`: `"humano"` (default) envía tal cual, sin llamadas extra. `"bot"` hace que cada envío
 *   individual de `mensajes` verifique el número, marque leído si se pasan `messageIds`, muestre
 *   "escribiendo" un tiempo proporcional al texto y recién entonces envíe.
 * - `bot`: ajustes del modo bot (`OpcionesModoBot`); solo válido con `modo: "bot"`.
 */
export interface OpcionesCliente extends OpcionesBaseCliente {
  apiKey: string;
  modo?: "humano" | "bot";
  bot?: OpcionesModoBot;
}

/** Cliente de la API pública (x-api-key): un namespace por feature. */
export interface ClienteWhatsapp {
  readonly mensajes: FacadeMensajesBot;
  readonly chats: FacadeChats;
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
 * @throws {ErrorConfiguracion} Si `apiKey`, `baseUrl`, `timeout`, `reintentos`, `modo` o `bot`
 *   son inválidos. Son las ÚNICAS excepciones: error de programación, no flujo de negocio.
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

  const modo = opciones.modo ?? "humano";
  if (modo !== "humano" && modo !== "bot") {
    throw new ErrorConfiguracion('modo debe ser "humano" o "bot"');
  }
  if (modo === "humano" && opciones.bot !== undefined) {
    throw new ErrorConfiguracion('bot solo es válido con modo "bot"');
  }
  const configBot = modo === "bot" ? resolverOpcionesBot(opciones.bot) : undefined;

  const http = construirHttpClient(opciones, autenticadorApiKey(opciones.apiKey));
  const chats = crearFacadeChats(http);
  const mensajes = crearFacadeMensajes(http);

  return {
    mensajes:
      configBot === undefined
        ? mensajes
        : aplicarModoBot({ mensajes, chats, config: configBot, signal: opciones.signal }),
    chats,
    sesion: crearFacadeSesion(http),
    programados: crearFacadeProgramados(http),
    webhooksFallidos: crearFacadeWebhooksFallidos(http),
    bufferWs: crearFacadeBufferWs(http),
    billing: crearFacadeBilling(http),
    seguridad: crearFacadeSeguridad(http),
    webhookSecret: crearFacadeWebhookSecret(http),
  };
};
