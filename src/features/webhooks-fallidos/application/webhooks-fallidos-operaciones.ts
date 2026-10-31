import type { HttpClient } from "../../../core/http-client/index.js";
import { segmentoRuta } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import {
  confirmacionWebhookFallidoSchema,
  idEventoFallidoSchema,
  listarWebhooksFallidosInputSchema,
  listarWebhooksFallidosResponseSchema,
} from "../domain/webhooks-fallidos-schemas.js";
import type {
  ConfirmacionWebhookFallido,
  ListarWebhooksFallidosInput,
  ListarWebhooksFallidosResponse,
} from "../domain/webhooks-fallidos-schemas.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import { iterarPaginas } from "../../../core/paginacion/index.js";

type Opciones = OpcionesOperacion | undefined;

export const listarWebhooksFallidos =
  (http: HttpClient) =>
  async (
    filtros: ListarWebhooksFallidosInput = {},
    options?: Opciones,
  ): Promise<Resultado<ListarWebhooksFallidosResponse>> => {
    const valido = validarEntrada(listarWebhooksFallidosInputSchema, filtros);
    if (!valido.success) return valido;
    return http.get("/v1/me/webhooks/failed", {
      query: { page: valido.data.page, limit: valido.data.limit, estado: valido.data.estado },
      schemaRespuesta: listarWebhooksFallidosResponseSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };

/** Programa el reintento de un evento. El reintento es asíncrono: `message` solo lo confirma. */
export const reintentarWebhookFallido =
  (http: HttpClient) =>
  async (id: number, options?: Opciones): Promise<Resultado<ConfirmacionWebhookFallido>> => {
    const valido = validarEntrada(idEventoFallidoSchema, id);
    if (!valido.success) return valido;
    return http.post(`/v1/me/webhooks/failed/${segmentoRuta(valido.data)}/retry`, undefined, {
      schemaRespuesta: confirmacionWebhookFallidoSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };

/** Reprograma todos los eventos pendientes y agotados. `message` trae la cantidad en texto. */
export const reintentarTodosWebhooksFallidos =
  (http: HttpClient) =>
  (options?: Opciones): Promise<Resultado<ConfirmacionWebhookFallido>> =>
    http.post("/v1/me/webhooks/failed/drain", undefined, {
      schemaRespuesta: confirmacionWebhookFallidoSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });

export const descartarWebhookFallido =
  (http: HttpClient) =>
  async (id: number, options?: Opciones): Promise<Resultado<ConfirmacionWebhookFallido>> => {
    const valido = validarEntrada(idEventoFallidoSchema, id);
    if (!valido.success) return valido;
    return http.delete(`/v1/me/webhooks/failed/${segmentoRuta(valido.data)}`, {
      schemaRespuesta: confirmacionWebhookFallidoSchema,
      // Un reintento tras un éxito perdido recibiría 404 y ocultaría el resultado real.
      reintentar: false,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };

/**
 * Recorre todos los eventos fallidos, página a página. Pide las páginas a demanda (de la 1 a la última); ante un fallo lanza un `Error` con el
 * `Resultado` de falla en `cause`. Ver `iterarPaginas`.
 */
export const iterarWebhooksFallidos =
  (http: HttpClient) =>
  (filtros: Omit<ListarWebhooksFallidosInput, "page"> = {}, options?: Opciones) =>
    iterarPaginas((page) => listarWebhooksFallidos(http)({ ...filtros, page }, options));
