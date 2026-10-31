import type { HttpClient } from "../../../core/http-client/index.js";
import { eliminarSesion } from "./eliminar-sesion.js";

/** Sesiones de WhatsApp activas (administración). */
export const crearFacadeSesiones = (http: HttpClient) => ({
  /** Desconecta y elimina la sesión activa de un teléfono (nunca la del sistema: 403). */
  eliminar: eliminarSesion(http),
});

export type FacadeSesiones = ReturnType<typeof crearFacadeSesiones>;
