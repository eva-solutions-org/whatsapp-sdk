import { ErrorConfiguracion } from "../errors/index.js";

/**
 * Contexto que el http client entrega al autenticador en CADA intento de request
 * (los reintentos vuelven a llamarlo: un token puede haberse renovado entre intentos).
 *
 * - `method`: verbo HTTP en mayúsculas.
 * - `url`: URL final (incluye path y query).
 * - `cuerpo`: bytes EXACTOS que viajan en el body (vacío si no hay body o es `FormData`).
 */
interface ContextoAutenticacion {
  method: string;
  url: URL;
  cuerpo: Uint8Array;
}

/**
 * Agrega headers de autenticación a cada request. Los headers que retorna GANAN sobre los
 * `headers` extra del consumidor. Un mismo http client sirve a los tres clientes:
 * x-api-key (`.`) y token Bearer de servicio (`./admin`, `./internal`).
 *
 * `ante401`: si está definido, ante una respuesta `401` el http client lo invoca con los headers
 * que se rechazaron (el autenticador invalida esa credencial) y reintenta UNA sola vez, aun en métodos no idempotentes:
 * un `401` significa que el servidor no procesó la request. Un segundo `401` se devuelve tal cual.
 */
export type Autenticador = ((
  contexto: ContextoAutenticacion,
) => Promise<Record<string, string>> | Record<string, string>) & {
  readonly ante401?: (headersRechazados: Headers) => void;
};

/** Autenticador de la API pública: header `x-api-key` fijo. */
export const autenticadorApiKey =
  (apiKey: string): Autenticador =>
  () => ({ "x-api-key": apiKey });

/**
 * Credenciales de `./admin` e `./internal`: un proveedor de tokens de servicio emitidos por Auth.
 *
 * - `obtenerToken`: entrega el token vigente (el proveedor lo cachea y renueva). Se invoca en
 *   cada intento de request.
 * - `invalidarToken`: opcional; descarta el token cacheado SOLO si sigue siendo `tokenRechazado`
 *   (así varias requests concurrentes con un 401 no provocan una estampida de tokens nuevos).
 *   Se invoca ante un `401`, antes del único reintento; puede ser directamente
 *   `proveedor.invalidate` del auth-sdk. Sin `invalidarToken` NO hay reintento ante 401: saldría
 *   con el mismo token cacheado.
 */
export interface CredencialesToken {
  obtenerToken: () => Promise<string>;
  invalidarToken?: (tokenRechazado: string) => void;
}

/**
 * Autenticador Bearer: `Authorization: Bearer <token>` con el token que entrega `obtenerToken`.
 * Si `obtenerToken` falla o devuelve algo que no es un string no vacío, la request no se envía
 * (500 local; solo se expone en `detalles` un `code` OAuth no sensible del error).
 *
 * @throws {ErrorConfiguracion} Si `obtenerToken` o `invalidarToken` no son funciones (al crearlo).
 */
export const autenticadorBearer = (credenciales: CredencialesToken): Autenticador => {
  const { obtenerToken, invalidarToken } = credenciales ?? {};
  if (typeof obtenerToken !== "function") {
    throw new ErrorConfiguracion("obtenerToken es requerido y debe ser una función");
  }
  if (invalidarToken !== undefined && typeof invalidarToken !== "function") {
    throw new ErrorConfiguracion("invalidarToken debe ser una función");
  }
  const autenticador: Autenticador = async () => {
    const token: unknown = await obtenerToken();
    if (typeof token !== "string" || token.length === 0) {
      throw new Error("obtenerToken no devolvió un token");
    }
    return { authorization: `Bearer ${token}` };
  };
  if (invalidarToken === undefined) {
    return autenticador;
  }
  return Object.assign(autenticador, {
    ante401: (headersRechazados: Headers) => {
      const token = headersRechazados.get("authorization")?.replace(/^Bearer /, "") ?? "";
      invalidarToken(token);
    },
  });
};
