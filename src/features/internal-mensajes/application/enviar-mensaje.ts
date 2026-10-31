import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import { enviarMensajeInputSchema, mensajeEnviadoSchema } from "../domain/index.js";
import type { EnviarMensajeInput, MensajeEnviado } from "../domain/index.js";

/**
 * POST /v1/internal/messages/send, firmado con HMAC S2S. Texto (`message`) o media
 * (`mediaUrl` + `mediaType`).
 *
 * No se reintenta (POST con nonce de un solo uso). Un fallo por timeout o red es ambiguo: el
 * mensaje pudo salir. Errores relevantes, todos como
 * `{ success: false, codigo }`:
 * - 401: firma/timestamp/replay/cliente desconocido (`codigoApi` trae el code S2S).
 * - 403: scope insuficiente para el tipo de mensaje, o `sourcePhone` fuera de la allowlist.
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
