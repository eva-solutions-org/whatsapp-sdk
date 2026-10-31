import { ErrorConfiguracion } from "../errors/index.js";
import type { Autenticador } from "../http-client/autenticador.js";
import { esSecretoHexValido, firmarHeadersS2S } from "./firmar-s2s.js";

/**
 * Credenciales de un service client para `./admin` e `./internal`.
 *
 * - `clientId`: slug del service client registrado en la API.
 * - `secretoHex`: secreto HMAC en hex (nunca se imprime ni se incluye en errores).
 */
export interface CredencialesS2S {
  clientId: string;
  secretoHex: string;
}

/**
 * Autenticador S2S: firma cada intento con el pathname y query de la URL FINAL y los bytes
 * exactos del body. No soporta bodies `FormData` (`soportaMultipart: false`).
 *
 * @throws {ErrorConfiguracion} Si `clientId` o `secretoHex` son inválidos (al crearlo).
 */
export const autenticadorS2S = (credenciales: CredencialesS2S): Autenticador => {
  const { clientId, secretoHex } = credenciales ?? {};
  if (typeof clientId !== "string" || clientId.length === 0) {
    throw new ErrorConfiguracion("clientId es requerido y debe ser string no vacío");
  }
  if (typeof secretoHex !== "string" || !esSecretoHexValido(secretoHex)) {
    throw new ErrorConfiguracion("secretoHex es requerido y debe ser un string hex válido");
  }
  const autenticador: Autenticador = ({ method, url, cuerpo }) =>
    firmarHeadersS2S({
      method,
      path: url.pathname,
      rawQuery: url.search.slice(1),
      cuerpo,
      clientId,
      secretoHex,
    });
  // La firma cubre los bytes del body; un FormData no los expone y se firmaría vacío (401).
  return Object.assign(autenticador, { soportaMultipart: false });
};
