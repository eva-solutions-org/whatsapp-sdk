import type { HttpClient } from "../../core/http-client/index.js";
import {
  cancelarProgramado,
  crearProgramado,
  iterarProgramados,
  listarProgramados,
  obtenerProgramado,
} from "./application/programados-operaciones.js";

/** Mensajes programados (`/v1/me/schedule`). */
export const crearFacadeProgramados = (http: HttpClient) => {
  return {
    crear: crearProgramado(http),
    listar: listarProgramados(http),
    iterar: iterarProgramados(http),
    obtener: obtenerProgramado(http),
    cancelar: cancelarProgramado(http),
  };
};

export type FacadeProgramados = ReturnType<typeof crearFacadeProgramados>;

export type {
  ConfirmacionProgramado,
  CrearProgramadoInput,
  EstadoMensajeProgramado,
  ListarProgramadosInput,
  ListarProgramadosResponse,
  ProgramadoDetalle,
  ProgramadoResumen,
  TipoMensajeProgramado,
} from "./domain/programados-schemas.js";
