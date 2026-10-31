import { autenticadorBearer } from "../http-client/index.js";
import type { CredencialesToken, HttpClient } from "../http-client/index.js";
import { construirHttpClient } from "./construir-http-client.js";
import type { OpcionesBaseCliente } from "./construir-http-client.js";

/** Opciones de los clientes `./admin` e `./internal`: opciones base + proveedor de tokens. */
export type OpcionesClienteConToken = OpcionesBaseCliente & CredencialesToken;

/**
 * http client con token Bearer de servicio, base de `./admin` e `./internal`.
 *
 * @throws {ErrorConfiguracion} `obtenerToken`, `invalidarToken`, `baseUrl`, `timeout` o
 *   `reintentos` inválidos.
 */
export const crearHttpClientConToken = (opciones: OpcionesClienteConToken): HttpClient =>
  construirHttpClient(
    opciones,
    autenticadorBearer({
      obtenerToken: opciones.obtenerToken,
      ...(opciones.invalidarToken !== undefined && { invalidarToken: opciones.invalidarToken }),
    }),
  );
