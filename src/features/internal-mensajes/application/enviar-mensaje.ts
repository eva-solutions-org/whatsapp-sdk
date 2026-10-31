import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import { enviarMensajeInputSchema, mensajeEnviadoSchema } from "../domain/index.js";
import type { EnviarMensajeInput, MensajeEnviado } from "../domain/index.js";

/**
 * POST /v1/internal/messages/send con token Bearer de servicio. Texto (`message`) o media
 * (`mediaUrl` + `mediaType`).
 *
 * Solo se reintenta ante un 401 (una vez, con token nuevo: la API no procesó el envío). Un fallo
 * por timeout o red es ambiguo: el mensaje pudo salir y no se reintenta. Errores relevantes, todos
 * como `{ success: false, codigo }`:
 * - 401: token inválido, vencido o de otra audiencia (`codigoApi` trae el code de la API) tras
 *   el reintento con token nuevo.
 * - 403: permiso insuficiente en el token para el tipo de mensaje, `sub` sin registro habilitado
 *   o `sourcePhone` fuera de la allowlist.
 * - 422: body inválido (`detalles`) o `sourcePhone` desconocido.
 * - 429: rate limit (`retryAfter`).
 * - 503: la sesión del `sourcePhone` no está disponible.
 */
export const enviarMensaje =
  (http: HttpClient) =>
  async (
    entrada: EnviarMensajeInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<MensajeEnviado>> => {
    const validada = validarEntrada(enviarMensajeInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.post("/v1/internal/messages/send", validada.data, {
      schemaRespuesta: mensajeEnviadoSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };
