import type { HttpClient } from "../../../core/http-client/index.js";
import { obtenerQr } from "./obtener-qr.js";
import { obtenerQrPng } from "./obtener-qr-png.js";

/** QR del teléfono del sistema (vinculación de la sesión del sistema). */
export const crearFacadeQrSistema = (http: HttpClient) => ({
  /** QR en texto (`raw`) o data URL (`base64`). Sin `qr` en la respuesta = ya conectado. */
  obtener: obtenerQr(http),
  /** QR como imagen PNG binaria. Ver la rareza documentada en `obtenerQrPng`. */
  obtenerPng: obtenerQrPng(http),
});

export type FacadeQrSistema = ReturnType<typeof crearFacadeQrSistema>;
