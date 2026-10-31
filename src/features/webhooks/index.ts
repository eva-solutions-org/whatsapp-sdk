/**
 * Contrato público del feature `webhooks`. No exporta las primitivas internas
 * (`verificarHmacSha256`, `leerCuerpoLimitado`) ni la regex de la firma.
 */

export { verificarFirmaWebhook, verificarWebhookDesdeRequest } from "./application/index.js";
export { HEADER_FIRMA_WEBHOOK } from "./domain/index.js";
export type { OpcionesVerificarRequest, VerificarFirmaInput } from "./domain/index.js";
