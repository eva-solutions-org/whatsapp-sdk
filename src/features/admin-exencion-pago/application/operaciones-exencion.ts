import { segmentoRuta } from "../../../core/http-client/index.js";
import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import { iterarCursor } from "../../../core/paginacion/index.js";
import {
  alternarExencionInputSchema,
  exencionAplicadaSchema,
  historialExencionInputSchema,
  historialExencionSchema,
} from "../domain/index.js";
import type {
  AlternarExencionInput,
  ExencionAplicada,
  HistorialExencion,
  HistorialExencionInput,
} from "../domain/index.js";

const rutaExencion = (userId: string): string =>
  `/v1/admin/billing/users/${segmentoRuta(userId)}/payment-exemption`;

/**
 * PATCH /v1/admin/billing/users/{userId}/payment-exemption. Idempotente; cada llamada deja un
 * registro histórico inmutable. 404 si el User no existe; 422 si `expiresAt` está en el pasado.
 */
export const alternarExencion =
  (http: HttpClient) =>
  async (
    entrada: AlternarExencionInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<ExencionAplicada>> => {
    const validada = validarEntrada(alternarExencionInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    const { userId, ...cuerpo } = validada.data;
    return http.patch(rutaExencion(userId), cuerpo, {
      schemaRespuesta: exencionAplicadaSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };

/**
 * GET /v1/admin/billing/users/{userId}/payment-exemption/history. Paginación por cursor;
 * cambiar los filtros invalida el cursor (un rango vacío es indistinguible del fin).
 */
export const historialExencion =
  (http: HttpClient) =>
  async (
    entrada: HistorialExencionInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<HistorialExencion>> => {
    const validada = validarEntrada(historialExencionInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    const { userId, ...query } = validada.data;
    return http.get(`${rutaExencion(userId)}/history`, {
      query,
      schemaRespuesta: historialExencionSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };

/** Recorre todo el historial de exención, página a página. Ante un fallo lanza un `Error` con el `Resultado` en `cause`. */
export const iterarHistorialExencion =
  (http: HttpClient) =>
  (entrada: Omit<HistorialExencionInput, "cursor">, opciones?: OpcionesOperacion) =>
    iterarCursor(
      (cursor) => historialExencion(http)({ ...entrada, cursor }, opciones),
      (historial) => ({
        items: historial.items,
        siguiente: historial.pagination.hasMore ? historial.pagination.nextCursor : null,
      }),
    );
