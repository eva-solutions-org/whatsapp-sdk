import type { Resultado } from "../../../core/types/index.js";

const MENSAJE_NO_LEGIBLE =
  "Body ya consumido o no legible. Pasa opciones.cuerpoCrudo explícitamente.";

/**
 * Lee el cuerpo de un `Request` como bytes sin superar `maxBytes`.
 *
 * - `Content-Length` declarado mayor al tope: 413 sin leer.
 * - Stream que excede el tope mientras se lee: se cancela y 413 (cubre chunked sin
 *   `Content-Length`).
 * - Body ya consumido o ilegible: 422.
 */
export const leerCuerpoLimitado = async (
  request: Request,
  maxBytes: number,
): Promise<Resultado<Uint8Array>> => {
  const demasiadoGrande: Resultado<never> = {
    success: false,
    error: "Body demasiado grande",
    codigo: 413,
    origen: "local",
  };
  const noLegible: Resultado<never> = {
    success: false,
    error: MENSAJE_NO_LEGIBLE,
    codigo: 422,
    origen: "local",
  };

  const declarado = Number.parseInt(request.headers.get("Content-Length") ?? "", 10);
  if (Number.isFinite(declarado) && declarado > maxBytes) {
    return demasiadoGrande;
  }
  if (request.body === null) {
    return { success: true, data: new Uint8Array(0) };
  }

  let lector: ReadableStreamDefaultReader<Uint8Array>;
  try {
    lector = request.body.getReader();
  } catch {
    return noLegible;
  }

  const trozos: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await lector.cancel().catch(() => undefined);
        return demasiadoGrande;
      }
      trozos.push(value);
    }
  } catch {
    return noLegible;
  }

  const bytes = new Uint8Array(total);
  let desplazamiento = 0;
  for (const trozo of trozos) {
    bytes.set(trozo, desplazamiento);
    desplazamiento += trozo.byteLength;
  }
  return { success: true, data: bytes };
};
