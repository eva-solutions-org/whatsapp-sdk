import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { ipVerificadaSchema, verificarIpInputSchema } from "../domain/seguridad-schemas.js";
import type { IpVerificada, VerificarIpInput } from "../domain/seguridad-schemas.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";

type Opciones = OpcionesOperacion | undefined;

/** Verifica la IP del llamador con el código de 6 dígitos. 400 si es inválido o expiró. */
export const verificarIp =
  (http: HttpClient) =>
  async (input: VerificarIpInput, options?: Opciones): Promise<Resultado<IpVerificada>> => {
    const valido = validarEntrada(verificarIpInputSchema, input);
    if (!valido.success) return valido;
    return http.post("/v1/security/verify-ip", valido.data, {
      schemaRespuesta: ipVerificadaSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };
