import type { HttpClient, RespuestaBinaria } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";

/**
 * GET /v1/admin/system-qr?format=png. Entrega el body crudo.
 *
 * Rareza de la API: si la sesión del sistema ya está conectada responde 200 con JSON
 * (`{ data: { message, phone } }`) aunque se pida PNG. El consumidor distingue por
 * `tipoContenido` (`image/png` vs `application/json`).
 */
export const obtenerQrPng =
  (http: HttpClient) =>
  async (opciones?: OpcionesOperacion): Promise<Resultado<RespuestaBinaria>> =>
    http.getBytes("/v1/admin/system-qr", {
      query: { format: "png" },
      signal: opciones?.signal,
      timeout: opciones?.timeout,
      // Sin reintentos: el GET dispara la sesión del sistema y espera el QR.
      reintentar: false,
    });
