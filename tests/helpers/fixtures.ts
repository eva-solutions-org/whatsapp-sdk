import { createHmac } from "node:crypto";

/**
 * Fixtures compartidos por los tests. Valores ficticios: ningún secreto real.
 */

export const API_KEY_TEST = "wa_test_fixture_abc123";
export const SECRETO_WEBHOOK_TEST = "s3cr3t-webhook-fixture-only";
export const TOKEN_SERVICIO_TEST = "token-de-servicio-fixture";

/**
 * Genera la firma `X-Webhook-Signature` válida (`sha256=<hex>`) para un cuerpo.
 *
 * Implementación independiente con `node:crypto` (como la API: `createHmac`), NO reutiliza
 * el código de producción para no acoplar el test a la implementación.
 */
export const generarFirmaWebhookTest = (cuerpo: string | Uint8Array, secreto: string): string =>
  `sha256=${createHmac("sha256", secreto).update(cuerpo).digest("hex")}`;

/** Evento `message` de texto con la forma exacta que emite la API. */
export const EVENTO_MENSAJE_TEXTO_FIXTURE = {
  type: "message",
  phone: "593999999999",
  timestamp: 1_767_000_000,
  data: {
    messageId: "3EB0ABCDEF",
    from: "593988888888",
    fromName: "Ana",
    isGroup: false,
    groupId: null,
    messageType: "text",
    content: { text: "hola" },
    quotedMessage: null,
    timestamp: 1_767_000_000,
  },
} as const;

/** Evento `connection`. */
export const EVENTO_CONEXION_FIXTURE = {
  type: "connection",
  phone: "593999999999",
  timestamp: 1_767_000_001,
  data: { status: "open", message: "Conectado" },
} as const;
