import type { HttpClient } from "../../core/http-client/index.js";
import { obtenerQr, obtenerQrPng } from "./application/sesion-operaciones.js";

/** Operaciones de la sesión de WhatsApp (`GET /v1/session/qr`). */
export const crearFacadeSesion = (http: HttpClient) => {
  return {
    obtenerQr: obtenerQr(http),
    obtenerQrPng: obtenerQrPng(http),
  };
};

export type FacadeSesion = ReturnType<typeof crearFacadeSesion>;

export type { ObtenerQrInput, QrSesion } from "./domain/sesion-schemas.js";
