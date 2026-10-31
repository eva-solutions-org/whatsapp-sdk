import type { HttpClient } from "../../../core/http-client/index.js";
import { segmentoRuta } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import {
  actualizarConfiguracionInputSchema,
  balanceSchema,
  configuracionActualizadaSchema,
  crearRecargaInputSchema,
  idRecargaSchema,
  listarMovimientosInputSchema,
  listarMovimientosResponseSchema,
  recargaSchema,
} from "../domain/billing-schemas.js";
import type {
  ActualizarConfiguracionBillingInput,
  BalanceBilling,
  ConfiguracionBillingActualizada,
  CrearRecargaInput,
  ListarMovimientosInput,
  ListarMovimientosResponse,
  Recarga,
} from "../domain/billing-schemas.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import { iterarPaginas } from "../../../core/paginacion/index.js";

type Opciones = OpcionesOperacion | undefined;

export const obtenerBalance =
  (http: HttpClient) =>
  (options?: Opciones): Promise<Resultado<BalanceBilling>> =>
    http.get("/v1/me/billing/balance", {
      schemaRespuesta: balanceSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });

export const listarMovimientos =
  (http: HttpClient) =>
  async (
    filtros: ListarMovimientosInput = {},
    options?: Opciones,
  ): Promise<Resultado<ListarMovimientosResponse>> => {
    const valido = validarEntrada(listarMovimientosInputSchema, filtros);
    if (!valido.success) return valido;
    return http.get("/v1/me/billing/movimientos", {
      query: { page: valido.data.page, limit: valido.data.limit, tipo: valido.data.tipo },
      schemaRespuesta: listarMovimientosResponseSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };

/** Inicia una recarga. No se reintenta automáticamente (POST): crea un pago en el procesador. */
export const crearRecarga =
  (http: HttpClient) =>
  async (input: CrearRecargaInput, options?: Opciones): Promise<Resultado<Recarga>> => {
    const valido = validarEntrada(crearRecargaInputSchema, input);
    if (!valido.success) return valido;
    return http.post("/v1/me/billing/recarga", valido.data, {
      schemaRespuesta: recargaSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };

export const obtenerRecarga =
  (http: HttpClient) =>
  async (id: string, options?: Opciones): Promise<Resultado<Recarga>> => {
    const valido = validarEntrada(idRecargaSchema, id);
    if (!valido.success) return valido;
    return http.get(`/v1/me/billing/recarga/${segmentoRuta(valido.data)}`, {
      schemaRespuesta: recargaSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };

export const actualizarConfiguracion =
  (http: HttpClient) =>
  async (
    input: ActualizarConfiguracionBillingInput,
    options?: Opciones,
  ): Promise<Resultado<ConfiguracionBillingActualizada>> => {
    const valido = validarEntrada(actualizarConfiguracionInputSchema, input);
    if (!valido.success) return valido;
    return http.put("/v1/me/billing/configuracion", valido.data, {
      schemaRespuesta: configuracionActualizadaSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };

/**
 * Recorre todos los movimientos de billing, página a página. Pide las páginas a demanda (de la 1 a la última); ante un fallo lanza un `Error` con el
 * `Resultado` de falla en `cause`. Ver `iterarPaginas`.
 */
export const iterarMovimientos =
  (http: HttpClient) =>
  (filtros: Omit<ListarMovimientosInput, "page"> = {}, options?: Opciones) =>
    iterarPaginas((page) => listarMovimientos(http)({ ...filtros, page }, options));
