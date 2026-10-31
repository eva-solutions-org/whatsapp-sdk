import { ErrorConfiguracion } from "../../../core/errors/index.js";

const codificador = new TextEncoder();

const hexABytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

/**
 * Verifica un HMAC-SHA256 con `crypto.subtle.verify`, que compara en tiempo constante
 * (no hay comparación manual de strings ni bytes).
 *
 * `firmaHex` debe venir validada (hex minúsculas, 64 chars). `secreto` se codifica UTF-8,
 * igual que `createHmac` en la API.
 *
 * @throws {ErrorConfiguracion} Si el runtime no expone WebCrypto (fail-closed).
 */
export const verificarHmacSha256 = async ({
  mensaje,
  secreto,
  firmaHex,
}: {
  mensaje: string | Uint8Array;
  secreto: string;
  firmaHex: string;
}): Promise<boolean> => {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    throw new ErrorConfiguracion("El runtime no expone WebCrypto (crypto.subtle)");
  }
  const clave = await subtle.importKey(
    "raw",
    codificador.encode(secreto) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const datos = typeof mensaje === "string" ? codificador.encode(mensaje) : mensaje;
  return subtle.verify("HMAC", clave, hexABytes(firmaHex) as BufferSource, datos as BufferSource);
};
