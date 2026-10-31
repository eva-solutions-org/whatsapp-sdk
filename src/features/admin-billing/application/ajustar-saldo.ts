import { segmentoRuta } from "../../../core/http-client/index.js";
import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import { ajusteSaldoSchema, ajustarSaldoInputSchema } from "../domain/index.js";
import type { AjusteSaldo, AjustarSaldoInput } from "../domain/index.js";

/**
 * POST /v1/admin/billing/users/{userId}/ajuste. El body lleva `tipo: "ajuste_manual"` fijo
 * (la API lo exige y rechaza campos desconocidos). 422 si el monto excede el cap admin sin
 * `forzar`; 400 si `moneda` no es la del User.
 */
export const ajustarSaldo =
  (http: HttpClient) =>
  async (
    entrada: AjustarSaldoInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<AjusteSaldo>> => {
    const validada = validarEntrada(ajustarSaldoInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    const { userId, ...campos } = validada.data;
    return http.post(
      `/v1/admin/billing/users/${segmentoRuta(userId)}/ajuste`,
      { tipo: "ajuste_manual", ...campos },
      { schemaRespuesta: ajusteSaldoSchema, signal: opciones?.signal, timeout: opciones?.timeout },
    );
  };
