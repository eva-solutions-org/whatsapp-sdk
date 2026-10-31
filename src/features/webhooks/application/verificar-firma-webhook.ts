import type { Resultado } from "../../../core/types/index.js";
import { REGEX_FIRMA_WEBHOOK } from "../domain/index.js";
import type { VerificarFirmaInput } from "../domain/index.js";
import { verificarHmacSha256 } from "../infrastructure/index.js";

/**
 * Verifica la firma `X-Webhook-Signature` de un webhook de la API.
 *
 * Todas las fallas son `codigo: 401` (Result Pattern, no lanza):
 *   1. `secreto` vacío.
 *   2. `firma` que no cumple `sha256=<hex64 minúsculas>`.
 *   3. HMAC-SHA256 de `cuerpoCrudo` distinto de la firma (comparación en tiempo constante).
 *
 * Solo lanza `ErrorConfiguracion` si el runtime no tiene WebCrypto.
 */
export const verificarFirmaWebhook = async (
  input: VerificarFirmaInput,
): Promise<Resultado<true>> => {
  if (typeof input.secreto !== "string" || input.secreto.length === 0) {
    return { success: false, error: "secreto ausente o vacío", codigo: 401, origen: "local" };
  }
  if (typeof input.firma !== "string" || !REGEX_FIRMA_WEBHOOK.test(input.firma)) {
    return {
      success: false,
      error: "Formato de firma inválido (esperado: sha256=<hex64 minúsculas>)",
      codigo: 401,
      origen: "local",
    };
  }

  const valida = await verificarHmacSha256({
    mensaje: input.cuerpoCrudo,
    secreto: input.secreto,
    firmaHex: input.firma.slice("sha256=".length),
  });
  if (!valida) {
    return { success: false, error: "Firma inválida", codigo: 401, origen: "local" };
  }
  return { success: true, data: true };
};
