import { segmentoRuta } from "../../../core/http-client/index.js";
import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import { cambiarMonedaInputSchema, cambioMonedaSchema } from "../domain/index.js";
import type { CambiarMonedaInput, CambioMoneda } from "../domain/index.js";

/**
 * PUT /v1/admin/billing/api-key/{phone}/moneda. Convierte saldo, costo por mensaje y umbral
 * del User dueño. 409 si `monedaActual` ya no coincide o hay pagos pendientes sin vencer.
 */
export const cambiarMoneda =
  (http: HttpClient) =>
  async (
    entrada: CambiarMonedaInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<CambioMoneda>> => {
    const validada = validarEntrada(cambiarMonedaInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    const { phone, ...cuerpo } = validada.data;
    return http.put(`/v1/admin/billing/api-key/${segmentoRuta(phone)}/moneda`, cuerpo, {
      schemaRespuesta: cambioMonedaSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };
