/**
 * Contexto que el http client entrega al autenticador en CADA intento de request
 * (los reintentos vuelven a llamarlo: una firma S2S lleva un nonce de un solo uso).
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
 * x-api-key (`.`) y firma S2S (`./admin`, `./internal`).
 *
 * `soportaMultipart: false` declara que no puede autenticar un body `FormData` (la firma S2S
 * cubre los bytes del body y un multipart no los expone): el http client lo rechaza con un 400
 * local en vez de enviar una firma inválida. Ausente = lo soporta.
 */
export type Autenticador = ((
  contexto: ContextoAutenticacion,
) => Promise<Record<string, string>> | Record<string, string>) & {
  readonly soportaMultipart?: boolean;
};

/** Autenticador de la API pública: header `x-api-key` fijo. */
export const autenticadorApiKey =
  (apiKey: string): Autenticador =>
  () => ({ "x-api-key": apiKey });
