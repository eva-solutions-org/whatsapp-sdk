import { segmentoRuta } from "../../../core/http-client/index.js";
import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import { iterarPaginas } from "../../../core/paginacion/index.js";
import { listarMovimientosInputSchema, listarMovimientosRespuestaSchema } from "../domain/index.js";
import type { ListarMovimientosInput, ListarMovimientosRespuesta } from "../domain/index.js";

/** GET /v1/admin/billing/api-key/{phone}/movimientos. */
export const listarMovimientos =
  (http: HttpClient) =>
  async (
    entrada: ListarMovimientosInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<ListarMovimientosRespuesta>> => {
    const validada = validarEntrada(listarMovimientosInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    const { phone, ...query } = validada.data;
    return http.get(`/v1/admin/billing/api-key/${segmentoRuta(phone)}/movimientos`, {
      query,
      schemaRespuesta: listarMovimientosRespuestaSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };

/** Recorre todos los movimientos de una API key, página a página. Ante un fallo lanza un `Error` con el `Resultado` en `cause`. */
export const iterarMovimientos =
  (http: HttpClient) =>
  (entrada: Omit<ListarMovimientosInput, "page">, opciones?: OpcionesOperacion) =>
    iterarPaginas((page) => listarMovimientos(http)({ ...entrada, page }, opciones));
