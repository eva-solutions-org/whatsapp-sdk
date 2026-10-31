import type { HttpClient } from "../../core/http-client/index.js";
import { enviarWebhookSecret } from "./application/webhook-secret-operaciones.js";

/** Webhook secret (`GET /v1/me/webhook-secret`). */
export const crearFacadeWebhookSecret = (http: HttpClient) => {
  return {
    /**
     * Pide que la API envíe el secreto por WhatsApp al teléfono de la API key. El secreto no
     * viaja en la respuesta HTTP. No se reintenta (GET con efecto: reenviaría el WhatsApp).
     */
    enviar: enviarWebhookSecret(http),
  };
};

export type FacadeWebhookSecret = ReturnType<typeof crearFacadeWebhookSecret>;

export type { EnvioWebhookSecret } from "./domain/webhook-secret-schemas.js";
