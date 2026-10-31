import { segmentoRuta } from "../../../core/http-client/index.js";
import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import { configuracionBillingSchema, configurarBillingInputSchema } from "../domain/index.js";
import type { ConfiguracionBilling, ConfigurarBillingInput } from "../domain/index.js";

/**
 * PUT /v1/admin/billing/api-key/{phone}/config. Hay que enviar al menos un campo (si no, 400
 * de la API).
 */
export const configurarBilling =
  (http: HttpClient) =>
  async (
    entrada: ConfigurarBillingInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<ConfiguracionBilling>> => {
    const validada = validarEntrada(configurarBillingInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    const { phone, ...cuerpo } = validada.data;
    return http.put(`/v1/admin/billing/api-key/${segmentoRuta(phone)}/config`, cuerpo, {
      schemaRespuesta: configuracionBillingSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };
