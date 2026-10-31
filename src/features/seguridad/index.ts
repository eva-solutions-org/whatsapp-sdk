import type { HttpClient } from "../../core/http-client/index.js";
import { verificarIp } from "./application/seguridad-operaciones.js";

/** Verificación de IP (`POST /v1/security/verify-ip`). */
export const crearFacadeSeguridad = (http: HttpClient) => {
  return {
    verificarIp: verificarIp(http),
  };
};

export type FacadeSeguridad = ReturnType<typeof crearFacadeSeguridad>;

export type { IpVerificada, VerificarIpInput } from "./domain/seguridad-schemas.js";
