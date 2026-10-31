import { flattenError } from "zod";
import type { ZodType } from "zod";
import type { Resultado } from "../types/index.js";

/** Opciones por operación, comunes a todas las operaciones del SDK. */
export interface OpcionesOperacion {
  /** Cancela esta operación. */
  signal?: AbortSignal | undefined;
  /**
   * Timeout en ms de esta operación (por intento); sobreescribe el del cliente. Número > 0.
   * Útil en operaciones que la API puede tardar en responder (QR hasta 30 s, envíos que
   * esperan la sesión hasta 15 s).
   */
  timeout?: number | undefined;
}

/**
 * Valida la entrada del consumidor ANTES de enviar. Un fallo es un 422 con
 * `detalles` en el mismo formato (`formErrors`/`fieldErrors`) que la API usa para su 422 (Result
 * Pattern, no lanza) y no sale ninguna request. El mensaje nunca incluye los valores recibidos,
 * solo qué campo falló y por qué.
 */
export const validarEntrada = <T>(schema: ZodType<T>, entrada: unknown): Resultado<T> => {
  const parseado = schema.safeParse(entrada);
  if (parseado.success) {
    return { success: true, data: parseado.data };
  }
  const motivos = parseado.error.issues
    .map((problema) => `${problema.path.join(".") || "entrada"}: ${problema.message}`)
    .join("; ");
  return {
    success: false,
    error: `Entrada inválida: ${motivos}`,
    codigo: 422,
    origen: "local",
    detalles: flattenError(parseado.error),
  };
};
