import type { HttpClient } from "../../../core/http-client/index.js";
import { enviarMensaje } from "./enviar-mensaje.js";

/**
 * Envío de mensajes entre servicios, con un token Bearer de servicio emitido por Auth.
 */
export const crearFacadeMensajesInternos = (http: HttpClient) => ({
  /**
   * Envía un texto o una media desde un `sourcePhone` permitido para el service client.
   * Un fallo por timeout o red (503) es de resultado ambiguo: el mensaje pudo salir. No se
   * reintenta solo; la API puede esperar hasta 15 s por la sesión, ajusta `timeout` si hace falta.
   */
  enviar: enviarMensaje(http),
});

export type FacadeMensajesInternos = ReturnType<typeof crearFacadeMensajesInternos>;
