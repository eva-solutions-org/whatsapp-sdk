import type { HttpClient } from "../../core/http-client/index.js";
import {
  contarWsPendientes,
  eliminarTodosWsPendientes,
  eliminarWsPendiente,
  iterarWsPendientes,
  listarWsPendientes,
} from "./application/buffer-ws-operaciones.js";

/** Buffer de eventos WebSocket pendientes (`/v1/me/ws/pending`). */
export const crearFacadeBufferWs = (http: HttpClient) => {
  return {
    listar: listarWsPendientes(http),
    iterar: iterarWsPendientes(http),
    contar: contarWsPendientes(http),
    eliminarTodos: eliminarTodosWsPendientes(http),
    eliminar: eliminarWsPendiente(http),
  };
};

export type FacadeBufferWs = ReturnType<typeof crearFacadeBufferWs>;

export type {
  ConfirmacionWsPendiente,
  ConteoWsPendientes,
  EventoWsPendiente,
  ListarWsPendientesInput,
  ListarWsPendientesResponse,
} from "./domain/buffer-ws-schemas.js";
