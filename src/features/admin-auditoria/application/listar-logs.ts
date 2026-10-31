import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import { iterarPaginas } from "../../../core/paginacion/index.js";
import { listarLogsInputSchema, listarLogsRespuestaSchema } from "../domain/index.js";
import type { ListarLogsInput, ListarLogsRespuesta } from "../domain/index.js";

/** GET /v1/admin/audit/logs. */
export const listarLogs =
  (http: HttpClient) =>
  async (
    entrada: ListarLogsInput = {},
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<ListarLogsRespuesta>> => {
    const validada = validarEntrada(listarLogsInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.get("/v1/admin/audit/logs", {
      query: validada.data,
      schemaRespuesta: listarLogsRespuestaSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };

/** Recorre todos los logs de auditoría, página a página. Ante un fallo lanza un `Error` con el `Resultado` en `cause`. */
export const iterarLogs =
  (http: HttpClient) =>
  (entrada: Omit<ListarLogsInput, "page"> = {}, opciones?: OpcionesOperacion) =>
    iterarPaginas((page) => listarLogs(http)({ ...entrada, page }, opciones));
