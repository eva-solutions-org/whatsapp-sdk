import { segmentoRuta } from "../../../core/http-client/index.js";
import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { mensajeConfirmacionSchema, validarEntrada } from "../../../core/validacion/index.js";
import type { MensajeConfirmacion, OpcionesOperacion } from "../../../core/validacion/index.js";
import {
  actualizarPrecioInputSchema,
  crearPrecioInputSchema,
  desactivarPrecioInputSchema,
  listaPreciosSchema,
  precioMonedaSchema,
} from "../domain/index.js";
import type {
  ActualizarPrecioInput,
  CrearPrecioInput,
  DesactivarPrecioInput,
  PrecioMoneda,
} from "../domain/index.js";

const RUTA_PRECIOS = "/v1/admin/billing/precios";

/** GET /v1/admin/billing/precios (incluye las monedas inactivas). */
export const listarPrecios =
  (http: HttpClient) =>
  async (opciones?: OpcionesOperacion): Promise<Resultado<PrecioMoneda[]>> =>
    http.get(RUTA_PRECIOS, {
      schemaRespuesta: listaPreciosSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });

/** POST /v1/admin/billing/precios. 409 si ya existe un precio para esa moneda. */
export const crearPrecio =
  (http: HttpClient) =>
  async (
    entrada: CrearPrecioInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<PrecioMoneda>> => {
    const validada = validarEntrada(crearPrecioInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.post(RUTA_PRECIOS, validada.data, {
      schemaRespuesta: precioMonedaSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };

/** PUT /v1/admin/billing/precios/{moneda}. 404 si no hay precio para esa moneda. */
export const actualizarPrecio =
  (http: HttpClient) =>
  async (
    entrada: ActualizarPrecioInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<PrecioMoneda>> => {
    const validada = validarEntrada(actualizarPrecioInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    const { moneda, ...cuerpo } = validada.data;
    return http.put(`${RUTA_PRECIOS}/${segmentoRuta(moneda)}`, cuerpo, {
      schemaRespuesta: precioMonedaSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };

/** DELETE /v1/admin/billing/precios/{moneda} (soft delete: marca la moneda como inactiva). */
export const desactivarPrecio =
  (http: HttpClient) =>
  async (
    entrada: DesactivarPrecioInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<MensajeConfirmacion>> => {
    const validada = validarEntrada(desactivarPrecioInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.delete(`${RUTA_PRECIOS}/${segmentoRuta(validada.data.moneda)}`, {
      schemaRespuesta: mensajeConfirmacionSchema,
      // Un reintento tras un éxito perdido recibiría 404 y ocultaría el resultado real.
      reintentar: false,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };
