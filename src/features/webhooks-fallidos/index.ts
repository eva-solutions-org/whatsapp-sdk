import type { HttpClient } from "../../core/http-client/index.js";
import {
  descartarWebhookFallido,
  iterarWebhooksFallidos,
  listarWebhooksFallidos,
  reintentarTodosWebhooksFallidos,
  reintentarWebhookFallido,
} from "./application/webhooks-fallidos-operaciones.js";

/** Eventos de webhook que fallaron al entregarse (`/v1/me/webhooks/failed`). */
export const crearFacadeWebhooksFallidos = (http: HttpClient) => {
  return {
    listar: listarWebhooksFallidos(http),
    iterar: iterarWebhooksFallidos(http),
    reintentar: reintentarWebhookFallido(http),
    reintentarTodos: reintentarTodosWebhooksFallidos(http),
    descartar: descartarWebhookFallido(http),
  };
};

export type FacadeWebhooksFallidos = ReturnType<typeof crearFacadeWebhooksFallidos>;

export type {
  ConfirmacionWebhookFallido,
  EstadoEventoFallido,
  EventoWebhookFallido,
  ListarWebhooksFallidosInput,
  ListarWebhooksFallidosResponse,
} from "./domain/webhooks-fallidos-schemas.js";
