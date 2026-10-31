import type { HttpClient } from "../../../core/http-client/index.js";
import { segmentoRuta } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import {
  confirmacionProgramadoSchema,
  crearProgramadoInputSchema,
  idProgramadoSchema,
  listarProgramadosInputSchema,
  listarProgramadosResponseSchema,
  programadoDetalleSchema,
  programadoResumenSchema,
} from "../domain/programados-schemas.js";
import type {
  ConfirmacionProgramado,
  CrearProgramadoInput,
  ListarProgramadosInput,
  ListarProgramadosResponse,
  ProgramadoDetalle,
  ProgramadoResumen,
} from "../domain/programados-schemas.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import { iterarPaginas } from "../../../core/paginacion/index.js";

type Opciones = OpcionesOperacion | undefined;

/** Programa un envío. `programadoPara` debe ser ISO 8601 y al menos 1 minuto en el futuro. */
export const crearProgramado =
  (http: HttpClient) =>
  async (
    input: CrearProgramadoInput,
    options?: Opciones,
  ): Promise<Resultado<ProgramadoResumen>> => {
    const valido = validarEntrada(crearProgramadoInputSchema, input);
    if (!valido.success) return valido;
    return http.post("/v1/me/schedule", valido.data, {
      schemaRespuesta: programadoResumenSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };

export const listarProgramados =
  (http: HttpClient) =>
  async (
    filtros: ListarProgramadosInput = {},
    options?: Opciones,
  ): Promise<Resultado<ListarProgramadosResponse>> => {
    const valido = validarEntrada(listarProgramadosInputSchema, filtros);
    if (!valido.success) return valido;
    return http.get("/v1/me/schedule", {
      query: { page: valido.data.page, limit: valido.data.limit },
      schemaRespuesta: listarProgramadosResponseSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };

export const obtenerProgramado =
  (http: HttpClient) =>
  async (id: number, options?: Opciones): Promise<Resultado<ProgramadoDetalle>> => {
    const valido = validarEntrada(idProgramadoSchema, id);
    if (!valido.success) return valido;
    return http.get(`/v1/me/schedule/${segmentoRuta(valido.data)}`, {
      schemaRespuesta: programadoDetalleSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };

/** Cancela un programado pendiente. 404 si no existe o ya no se puede cancelar. */
export const cancelarProgramado =
  (http: HttpClient) =>
  async (id: number, options?: Opciones): Promise<Resultado<ConfirmacionProgramado>> => {
    const valido = validarEntrada(idProgramadoSchema, id);
    if (!valido.success) return valido;
    return http.delete(`/v1/me/schedule/${segmentoRuta(valido.data)}`, {
      schemaRespuesta: confirmacionProgramadoSchema,
      // Un reintento tras un éxito perdido recibiría 404 y ocultaría el resultado real.
      reintentar: false,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };

/**
 * Recorre todos los programados, página a página. Pide las páginas a demanda (de la 1 a la última); ante un fallo lanza un `Error` con el
 * `Resultado` de falla en `cause`. Ver `iterarPaginas`.
 */
export const iterarProgramados =
  (http: HttpClient) =>
  (filtros: Omit<ListarProgramadosInput, "page"> = {}, options?: Opciones) =>
    iterarPaginas((page) => listarProgramados(http)({ ...filtros, page }, options));
