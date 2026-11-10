/**
 * Subpath `@eva_solutions/whatsapp-sdk/internal`: envío interno de mensajes
 * (`/v1/internal/*`), autenticado con un token Bearer de servicio (`aud: whatsapp-api`, permiso
 * por ruta) emitido por Auth. El SDK no depende del auth-sdk: el consumidor pasa su proveedor.
 *
 * ```ts
 * const interno = crearClienteInterno({
 *   baseUrl,
 *   obtenerToken: () => proveedor.getToken(),
 *   invalidarToken: proveedor.invalidate, // recibe el token rechazado
 * });
 * const r = await interno.mensajes.enviar({ phone, message, sourcePhone });
 * ```
 *
 * Ante un `401` (token inválido o vencido) se invoca `invalidarToken` y la request se reintenta
 * UNA vez con un token nuevo, también el POST de envío: el 401 significa que la API no lo procesó.
 * Un `403` indica permiso insuficiente, `sub` sin registro habilitado o `sourcePhone` fuera de la
 * allowlist. Fuera del 401, los POST no se reintentan.
 */

import { crearHttpClientConToken } from "./core/cliente/index.js";
import type { OpcionesClienteConToken } from "./core/cliente/index.js";
import { crearFacadeChatsInternos } from "./features/internal-chats/index.js";
import type { FacadeChatsInternos } from "./features/internal-chats/index.js";
import { crearFacadeMensajesInternos } from "./features/internal-mensajes/index.js";
import type { FacadeMensajesInternos } from "./features/internal-mensajes/index.js";
import { aplicarModoBotInterno, resolverModoBot } from "./features/modo-bot/index.js";
import type { OpcionesModoBot } from "./features/modo-bot/index.js";

/**
 * Opciones de `crearClienteInterno`: las de los clientes con token (`OpcionesClienteConToken`)
 * más el modo bot.
 *
 * - `modo`: `"humano"` (default) envía tal cual, sin llamadas extra. `"bot"` hace que cada
 *   `mensajes.enviar` verifique el número, muestre "escribiendo" un tiempo proporcional al texto
 *   y recién entonces envíe. No marca leído (no existe en la vía interna).
 * - `bot`: ajustes del modo bot (`OpcionesModoBot`, los mismos que el cliente público); solo
 *   válido con `modo: "bot"`. `alAdvertir` nunca recibe el paso `"leer"`.
 */
export type OpcionesClienteInterno = OpcionesClienteConToken & {
  modo?: "humano" | "bot";
  bot?: OpcionesModoBot;
};

/** Cliente `./internal`. */
export interface ClienteInterno {
  readonly mensajes: FacadeMensajesInternos;
  readonly chats: FacadeChatsInternos;
}

/**
 * Crea el cliente interno.
 *
 * `obtenerToken` entrega el token de servicio vigente (el proveedor lo cachea y renueva); el token
 * nunca aparece en mensajes de error.
 *
 * @throws {ErrorConfiguracion} `obtenerToken`, `invalidarToken`, `baseUrl`, `timeout`,
 *   `reintentos`, `modo` o `bot` inválidos (error de programación, no flujo de negocio).
 */
export const crearClienteInterno = (opciones: OpcionesClienteInterno): ClienteInterno => {
  const configBot = resolverModoBot(opciones.modo, opciones.bot);
  const http = crearHttpClientConToken(opciones);
  const chats = crearFacadeChatsInternos(http);
  const mensajes = crearFacadeMensajesInternos(http);
  return {
    mensajes:
      configBot === undefined
        ? mensajes
        : aplicarModoBotInterno({ mensajes, chats, config: configBot, signal: opciones.signal }),
    chats,
  };
};

export { crearHttpClientConToken } from "./core/cliente/index.js";
export type { OpcionesClienteConToken } from "./core/cliente/index.js";
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

export type {
  OpcionesModoBot,
  OpcionesEscrituraBot,
  AdvertenciaBot,
  PoliticaFalloVerificacion,
} from "./features/modo-bot/index.js";
export {
  CODIGO_NUMERO_SIN_WHATSAPP,
  CODIGO_VERIFICACION_NO_DISPONIBLE,
} from "./features/modo-bot/index.js";
export type {
  FacadeChatsInternos,
  ExistenciaNumeroInterno,
  IndicarEscrituraInternoInput,
  VerificarExistenciaInternoInput,
} from "./features/internal-chats/index.js";
export type { FacadeMensajesInternos } from "./features/internal-mensajes/index.js";
export type {
  EnviarMediaInput,
  EnviarMensajeInput,
  EnviarTextoInput,
  MensajeEnviado,
} from "./features/internal-mensajes/index.js";
