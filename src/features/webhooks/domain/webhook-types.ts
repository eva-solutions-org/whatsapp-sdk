/**
 * Tipos y constantes del feature `webhooks` (verificación de firma).
 *
 * La API (`Whatsapp-api/src/lib/webhook-http-utils.ts`, `firmarPayload`) envía:
 *   - Header `X-Webhook-Signature: sha256=<hex minúsculas>`.
 *   - Firma = HMAC-SHA256(secreto UTF-8, cuerpo exacto enviado = `JSON.stringify(evento)`).
 * El cuerpo se firma tal cual viaja: verifícalo sobre los bytes crudos, NUNCA sobre un JSON
 * re-serializado.
 *
 * La regex es case-sensitive: la API no produce mayúsculas en ningún tramo de la firma, así
 * que `SHA256=...` o hex en mayúsculas se rechazan.
 */

export const HEADER_FIRMA_WEBHOOK = "X-Webhook-Signature";

export const REGEX_FIRMA_WEBHOOK = /^sha256=[a-f0-9]{64}$/;

/** Tope por defecto del cuerpo leído desde un `Request` (1 MiB). */
export const MAX_BYTES_CUERPO_WEBHOOK = 1024 * 1024;

/** Input de `verificarFirmaWebhook`. */
export interface VerificarFirmaInput {
  /** Cuerpo exacto recibido (string UTF-8 o bytes). */
  cuerpoCrudo: string | Uint8Array;
  /** Valor del header `X-Webhook-Signature`. */
  firma: string;
  /** Webhook secret de la API key. */
  secreto: string;
}

/** Opciones de `verificarWebhookDesdeRequest`. */
export interface OpcionesVerificarRequest {
  /**
   * Cuerpo ya leído. Úsalo cuando el framework consumió el stream del `Request`
   * (Hono / Workers): evita `Body has already been used`.
   */
  cuerpoCrudo?: string | Uint8Array;
  /** Tope de bytes del cuerpo (default 1 MiB). Excederlo retorna 413. */
  maxBytesCuerpo?: number;
}
