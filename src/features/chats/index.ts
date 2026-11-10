import type { HttpClient } from "../../core/http-client/index.js";
import {
  cambiarPresencia,
  indicarEscritura,
  marcarLeido,
  verificarExistencia,
} from "./application/chats-operaciones.js";

/**
 * Primitivas de chat (`/v1/chats/*` y `/v1/presence`). No cobran. Las usa el modo bot del
 * cliente, pero también se pueden llamar sueltas.
 */
export const crearFacadeChats = (http: HttpClient) => {
  return {
    indicarEscritura: indicarEscritura(http),
    verificarExistencia: verificarExistencia(http),
    marcarLeido: marcarLeido(http),
    cambiarPresencia: cambiarPresencia(http),
  };
};

export type FacadeChats = ReturnType<typeof crearFacadeChats>;

export type {
  CambiarPresenciaInput,
  ExistenciaNumero,
  IndicarEscrituraInput,
  MarcarLeidoInput,
  VerificarExistenciaInput,
} from "./domain/chats-schemas.js";
