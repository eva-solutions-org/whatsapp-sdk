import type { HttpClient, RespuestaBinaria } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { obtenerQrInputSchema, qrSchema } from "../domain/sesion-schemas.js";
import type { ObtenerQrInput, QrSesion } from "../domain/sesion-schemas.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";

type Opciones = OpcionesOperacion | undefined;

/**
 * Pide el QR de vinculación en JSON (`raw` por defecto, o `base64`). Si la sesión ya está
 * conectada la API responde 409; si el QR no llega a tiempo, 408.
 *
 * No se reintenta: el GET crea la sesión si no existe y espera hasta 408 a que WhatsApp
 * emita el QR; reintentar tras un timeout reiniciaría esa espera/reconexión.
 */
export const obtenerQr =
  (http: HttpClient) =>
  async (input: ObtenerQrInput = {}, options?: Opciones): Promise<Resultado<QrSesion>> => {
    const valido = validarEntrada(obtenerQrInputSchema, input);
    if (!valido.success) return valido;
    return http.get("/v1/session/qr", {
      query: { format: valido.data.format },
      schemaRespuesta: qrSchema,
      signal: options?.signal,
      timeout: options?.timeout,
      reintentar: false,
    });
  };

/** Pide el QR como imagen PNG (`format=png`): `bytes` + `tipoContenido`. Sin reintentos (ver `obtenerQr`). */
export const obtenerQrPng =
  (http: HttpClient) =>
  (options?: Opciones): Promise<Resultado<RespuestaBinaria>> =>
    http.getBytes("/v1/session/qr", {
      query: { format: "png" },
      signal: options?.signal,
      timeout: options?.timeout,
      reintentar: false,
    });
