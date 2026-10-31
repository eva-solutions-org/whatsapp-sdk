import { segmentoRuta } from "../../../core/http-client/index.js";
import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { mensajeConfirmacionSchema, validarEntrada } from "../../../core/validacion/index.js";
import type { MensajeConfirmacion, OpcionesOperacion } from "../../../core/validacion/index.js";
import { eliminarSesionInputSchema } from "../domain/index.js";
import type { EliminarSesionInput } from "../domain/index.js";

/**
 * DELETE /v1/admin/sessions/{phone}. 403 si es la sesión del sistema; 404 si no hay sesión
 * activa para ese teléfono.
 */
export const eliminarSesion =
  (http: HttpClient) =>
  async (
    entrada: EliminarSesionInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<MensajeConfirmacion>> => {
    const validada = validarEntrada(eliminarSesionInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.delete(`/v1/admin/sessions/${segmentoRuta(validada.data.phone)}`, {
      schemaRespuesta: mensajeConfirmacionSchema,
      // Un reintento tras un éxito perdido recibiría 404 y ocultaría el resultado real.
      reintentar: false,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };
