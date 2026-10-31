import type { HttpClient } from "../http-client/index.js";
import { autenticadorS2S } from "../s2s/index.js";
import type { CredencialesS2S } from "../s2s/index.js";
import { construirHttpClient } from "./construir-http-client.js";
import type { OpcionesBaseCliente } from "./construir-http-client.js";

/** Opciones de los clientes `./admin` e `./internal`: opciones base + credenciales S2S. */
export type OpcionesClienteS2S = OpcionesBaseCliente & CredencialesS2S;

/**
 * http client firmado con HMAC S2S, base de `./admin` e `./internal`.
 *
 * @throws {ErrorConfiguracion} `clientId`, `secretoHex`, `baseUrl`, `timeout` o `reintentos`
 *   inválidos.
 */
export const crearHttpClientS2S = (opciones: OpcionesClienteS2S): HttpClient =>
  construirHttpClient(
    opciones,
    autenticadorS2S({ clientId: opciones.clientId, secretoHex: opciones.secretoHex }),
  );
