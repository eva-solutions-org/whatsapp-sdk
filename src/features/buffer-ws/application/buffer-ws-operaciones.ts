import type { HttpClient } from "../../../core/http-client/index.js";
import { segmentoRuta } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import {
  confirmacionWsPendienteSchema,
  conteoWsPendientesSchema,
  idWsPendienteSchema,
  listarWsPendientesInputSchema,
  listarWsPendientesResponseSchema,
} from "../domain/buffer-ws-schemas.js";
import type {
  ConfirmacionWsPendiente,
  ConteoWsPendientes,
  ListarWsPendientesInput,
  ListarWsPendientesResponse,
} from "../domain/buffer-ws-schemas.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import { iterarPaginas } from "../../../core/paginacion/index.js";

type Opciones = OpcionesOperacion | undefined;

export const listarWsPendientes =
  (http: HttpClient) =>
  async (
    filtros: ListarWsPendientesInput = {},
    options?: Opciones,
  ): Promise<Resultado<ListarWsPendientesResponse>> => {
    const valido = validarEntrada(listarWsPendientesInputSchema, filtros);
    if (!valido.success) return valido;
    return http.get("/v1/me/ws/pending", {
      query: { page: valido.data.page, limit: valido.data.limit },
      schemaRespuesta: listarWsPendientesResponseSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };

export const contarWsPendientes =
  (http: HttpClient) =>
  (options?: Opciones): Promise<Resultado<ConteoWsPendientes>> =>
    http.get("/v1/me/ws/pending/count", {
      schemaRespuesta: conteoWsPendientesSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });

export const eliminarTodosWsPendientes =
  (http: HttpClient) =>
  (options?: Opciones): Promise<Resultado<ConfirmacionWsPendiente>> =>
    http.delete("/v1/me/ws/pending", {
      schemaRespuesta: confirmacionWsPendienteSchema,
      // Un reintento tras un éxito perdido recibiría 404 y ocultaría el resultado real.
      reintentar: false,
      signal: options?.signal,
      timeout: options?.timeout,
    });

export const eliminarWsPendiente =
  (http: HttpClient) =>
  async (id: number, options?: Opciones): Promise<Resultado<ConfirmacionWsPendiente>> => {
    const valido = validarEntrada(idWsPendienteSchema, id);
    if (!valido.success) return valido;
    return http.delete(`/v1/me/ws/pending/${segmentoRuta(valido.data)}`, {
      schemaRespuesta: confirmacionWsPendienteSchema,
      // Un reintento tras un éxito perdido recibiría 404 y ocultaría el resultado real.
      reintentar: false,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };

/**
 * Recorre todos los eventos pendientes del buffer, página a página. Pide las páginas a demanda (de la 1 a la última); ante un fallo lanza un `Error` con el
 * `Resultado` de falla en `cause`. Ver `iterarPaginas`.
 */
export const iterarWsPendientes =
  (http: HttpClient) =>
  (filtros: Omit<ListarWsPendientesInput, "page"> = {}, options?: Opciones) =>
    iterarPaginas((page) => listarWsPendientes(http)({ ...filtros, page }, options));
