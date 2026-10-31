import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import { obtenerUsoInputSchema, usoApiKeySchema } from "../domain/index.js";
import type { ObtenerUsoInput, UsoApiKey } from "../domain/index.js";

/** GET /v1/admin/audit/analytics/usage. */
export const obtenerUso =
  (http: HttpClient) =>
  async (entrada: ObtenerUsoInput, opciones?: OpcionesOperacion): Promise<Resultado<UsoApiKey>> => {
    const validada = validarEntrada(obtenerUsoInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.get("/v1/admin/audit/analytics/usage", {
      query: validada.data,
      schemaRespuesta: usoApiKeySchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };
