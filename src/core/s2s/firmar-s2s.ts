/**
 * Firma HMAC-SHA-256 S2S (service-to-service) con WebCrypto.
 *
 * La fuente de verdad del algoritmo es `@eva_solutions/auth-sdk` (`s2s/sign.ts`); esta es
 * una reimplementación para no depender del auth-sdk en runtime. `tests/s2s` verifica,
 * contra el auth-sdk real, que ambas producen el mismo canonical string y la misma firma.
 *
 * Canonical string (7 líneas, unidas con `\n`):
 *   METHOD, PATH, QUERY_CANONICO, TIMESTAMP, NONCE, CLIENT_ID, SHA256(body) en hex
 *
 * Headers resultantes: `x-eva-client-id`, `x-eva-timestamp` (epoch en segundos),
 * `x-eva-nonce` (32 hex minúsculas, nuevo por request) y `x-eva-signature` (`sha256=<hex>`).
 *
 * Corre en cualquier runtime con `globalThis.crypto.subtle` (Node >=22, Workers, browsers).
 */

/** SHA-256 hex del body vacío. */
const SHA256_CUERPO_VACIO_HEX = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const REGEX_NONCE = /^[0-9a-f]{32}$/;
const REGEX_HEX = /^(?:[0-9a-f]{2})+$/i;
const codificador = new TextEncoder();

/** Componentes del request que entran en el canonical string. */
export interface PartesCanonicasS2S {
  /** Verbo HTTP (se normaliza a mayúsculas). */
  method: string;
  /** Pathname sin query ni fragmento. */
  path: string;
  /** Query crudo sin `?` (vacío si no hay). */
  rawQuery: string;
  /** Epoch en segundos, como string decimal. */
  timestamp: string;
  /** 32 hex minúsculas. */
  nonce: string;
  clientId: string;
  /** Bytes EXACTOS del body (vacío si no hay). */
  cuerpo: Uint8Array;
}

const bytesAHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const hexABytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

/** `true` si `valor` es un secreto hex utilizable (longitud par, solo `[0-9a-f]`). */
export const esSecretoHexValido = (valor: string): boolean => REGEX_HEX.test(valor);

const sha256Hex = async (datos: Uint8Array): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", datos as BufferSource);
  return bytesAHex(new Uint8Array(digest));
};

/** RFC 3986 estricto: `encodeURIComponent` deja sin codificar `! * ' ( )`. */
const codificarRfc3986 = (valor: string): string =>
  encodeURIComponent(valor).replace(
    /[!*'()]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/**
 * Query canónico: separa por `&`, decodifica, ordena por (nombre, valor) y recodifica
 * RFC 3986. Query vacío -> `""`. Lanza `URIError` si el query tiene escapes malformados.
 */
const canonicalizarQuery = (rawQuery: string): string => {
  if (rawQuery === "") {
    return "";
  }
  const pares: Array<{ nombre: string; valor: string }> = [];
  for (const par of rawQuery.split("&")) {
    if (par === "") continue;
    const igual = par.indexOf("=");
    pares.push(
      igual === -1
        ? { nombre: decodeURIComponent(par), valor: "" }
        : {
            nombre: decodeURIComponent(par.slice(0, igual)),
            valor: decodeURIComponent(par.slice(igual + 1)),
          },
    );
  }
  pares.sort((a, b) => {
    if (a.nombre !== b.nombre) return a.nombre < b.nombre ? -1 : 1;
    if (a.valor !== b.valor) return a.valor < b.valor ? -1 : 1;
    return 0;
  });
  return pares
    .map(({ nombre, valor }) => `${codificarRfc3986(nombre)}=${codificarRfc3986(valor)}`)
    .join("&");
};

/** Genera un nonce S2S: 16 bytes aleatorios como 32 hex minúsculas. */
const generarNonceS2S = (): string =>
  bytesAHex(globalThis.crypto.getRandomValues(new Uint8Array(16)));

/** Construye el canonical string de 7 líneas. */
export const construirCadenaCanonicaS2S = async (partes: PartesCanonicasS2S): Promise<string> => {
  // El body se hashea antes de canonicalizar el query, igual que el auth-sdk.
  const hashCuerpo =
    partes.cuerpo.length === 0 ? SHA256_CUERPO_VACIO_HEX : await sha256Hex(partes.cuerpo);
  return [
    partes.method.toUpperCase(),
    partes.path,
    canonicalizarQuery(partes.rawQuery),
    partes.timestamp,
    partes.nonce,
    partes.clientId,
    hashCuerpo,
  ].join("\n");
};

/**
 * Firma el canonical string. Retorna `sha256=<hex minúsculas>`.
 *
 * @throws Si `secretoHex` no es hex válido o el nonce no es canónico (errores de programación).
 */
export const firmarS2S = async ({
  partes,
  secretoHex,
}: {
  partes: PartesCanonicasS2S;
  secretoHex: string;
}): Promise<string> => {
  if (!REGEX_NONCE.test(partes.nonce)) {
    throw new Error("nonce S2S inválido (se requieren 32 hex en minúsculas)");
  }
  if (!esSecretoHexValido(secretoHex)) {
    throw new Error("secreto S2S inválido (formato hex requerido)");
  }
  const cadena = await construirCadenaCanonicaS2S(partes);
  const clave = await globalThis.crypto.subtle.importKey(
    "raw",
    hexABytes(secretoHex) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firma = await globalThis.crypto.subtle.sign(
    "HMAC",
    clave,
    codificador.encode(cadena) as BufferSource,
  );
  return `sha256=${bytesAHex(new Uint8Array(firma))}`;
};

/**
 * Genera los 4 headers S2S de un request (timestamp y nonce nuevos en cada llamada: no
 * reutilices los headers en otro request).
 */
export const firmarHeadersS2S = async ({
  method,
  path,
  rawQuery = "",
  cuerpo = new Uint8Array(0),
  clientId,
  secretoHex,
}: {
  method: string;
  path: string;
  rawQuery?: string;
  cuerpo?: Uint8Array;
  clientId: string;
  secretoHex: string;
}): Promise<Record<string, string>> => {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = generarNonceS2S();
  const firma = await firmarS2S({
    partes: { method, path, rawQuery, timestamp, nonce, clientId, cuerpo },
    secretoHex,
  });
  return {
    "x-eva-client-id": clientId,
    "x-eva-timestamp": timestamp,
    "x-eva-nonce": nonce,
    "x-eva-signature": firma,
  };
};
