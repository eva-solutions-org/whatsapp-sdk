import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import { obtenerQrInputSchema, qrSistemaSchema } from "../domain/index.js";
import type { ObtenerQrInput, QrSistema } from "../domain/index.js";

/** GET /v1/admin/system-qr?format=raw|base64. */
export const obtenerQr =
  (http: HttpClient) =>
  async (
    entrada: ObtenerQrInput = {},
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<QrSistema>> => {
    const validada = validarEntrada(obtenerQrInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.get("/v1/admin/system-qr", {
      query: { format: validada.data.formato },
      schemaRespuesta: qrSistemaSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
      // Sin reintentos: el GET dispara la sesión del sistema y espera el QR (ver sesion.qr).
      reintentar: false,
    });
  };
