import { validarBaseUrl } from "../../../core/cliente/validar-base-url.js";
import { ErrorConfiguracion } from "../../../core/errors/index.js";
import { RUTA_WS_EVENTOS, SUBPROTOCOLO_APIKEY } from "../domain/index.js";

/** Caracteres de un token de subprotocolo (RFC 6455 / RFC 7230); excluye coma y espacios. */
const TOKEN_SUBPROTOCOLO = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * URL `ws(s)://host/v1/ws/events` y subprotocolos `["apikey", <key>]` (formato que exige la API).
 * Lanza `ErrorConfiguracion` si `baseUrl` o `apiKey` no son válidos (sin repetir su valor).
 */
export const construirConexionWs = (
  baseUrl: string,
  apiKey: unknown,
): { url: string; protocolos: [string, string] } => {
  const origin = validarBaseUrl(baseUrl);
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    throw new ErrorConfiguracion("apiKey es requerida y debe ser string no vacío");
  }
  if (!TOKEN_SUBPROTOCOLO.test(apiKey)) {
    throw new ErrorConfiguracion(
      "apiKey contiene caracteres no válidos para Sec-WebSocket-Protocol",
    );
  }
  return {
    url: `${origin.replace(/^http/, "ws")}${RUTA_WS_EVENTOS}`,
    protocolos: [SUBPROTOCOLO_APIKEY, apiKey],
  };
};
