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
import { crearFacadeMensajesInternos } from "./features/internal-mensajes/index.js";
import type { FacadeMensajesInternos } from "./features/internal-mensajes/index.js";

/** Cliente `./internal`. */
export interface ClienteInterno {
  readonly mensajes: FacadeMensajesInternos;
}

/**
 * Crea el cliente interno.
 *
 * `obtenerToken` entrega el token de servicio vigente (el proveedor lo cachea y renueva); el token
 * nunca aparece en mensajes de error.
 *
 * @throws {ErrorConfiguracion} `obtenerToken`, `invalidarToken`, `baseUrl`, `timeout` o
 *   `reintentos` inválidos (error de programación, no flujo de negocio).
 */
export const crearClienteInterno = (opciones: OpcionesClienteConToken): ClienteInterno => ({
  mensajes: crearFacadeMensajesInternos(crearHttpClientConToken(opciones)),
});

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

export type { FacadeMensajesInternos } from "./features/internal-mensajes/index.js";
export type {
  EnviarMediaInput,
  EnviarMensajeInput,
  EnviarTextoInput,
  MensajeEnviado,
} from "./features/internal-mensajes/index.js";
