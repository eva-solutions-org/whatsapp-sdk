import { segmentoRuta } from "../../../core/http-client/index.js";
import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import {
  pagoCancelacionSchema,
  pagoConsultadoSchema,
  pagoIdInputSchema,
  pagoReembolsoSchema,
  reembolsarPagoInputSchema,
} from "../domain/index.js";
import type {
  PagoCancelacion,
  PagoConsultado,
  PagoIdInput,
  PagoReembolso,
  ReembolsarPagoInput,
} from "../domain/index.js";

const RUTA_PAGOS = "/v1/admin/billing/pagos";

// Los tres endpoints responden 503 ("Pagos deshabilitado") si la API corre con
// FEATURE_PAGOS_ENABLED apagado; la API no lo documenta en sus rutas.

/** GET /v1/admin/billing/pagos/{id}. */
export const obtenerPago =
  (http: HttpClient) =>
  async (
    entrada: PagoIdInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<PagoConsultado>> => {
    const validada = validarEntrada(pagoIdInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.get(`${RUTA_PAGOS}/${segmentoRuta(validada.data.id)}`, {
      schemaRespuesta: pagoConsultadoSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };

/** POST /v1/admin/billing/pagos/{id}/cancelar. 409 si el estado es terminal o sin id externo. */
export const cancelarPago =
  (http: HttpClient) =>
  async (
    entrada: PagoIdInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<PagoCancelacion>> => {
    const validada = validarEntrada(pagoIdInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.post(`${RUTA_PAGOS}/${segmentoRuta(validada.data.id)}/cancelar`, undefined, {
      schemaRespuesta: pagoCancelacionSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };

/**
 * POST /v1/admin/billing/pagos/{id}/refund. Sin `monto` es reembolso total. El body se envía
 * siempre (`{}` si no hay monto): la API lo declara opcional y así no depende de cómo trate
 * un POST sin cuerpo.
 */
export const reembolsarPago =
  (http: HttpClient) =>
  async (
    entrada: ReembolsarPagoInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<PagoReembolso>> => {
    const validada = validarEntrada(reembolsarPagoInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    const { id, ...cuerpo } = validada.data;
    return http.post(`${RUTA_PAGOS}/${segmentoRuta(id)}/refund`, cuerpo, {
      schemaRespuesta: pagoReembolsoSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };
