import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { envioWebhookSecretSchema } from "../domain/webhook-secret-schemas.js";
import type { EnvioWebhookSecret } from "../domain/webhook-secret-schemas.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";

type Opciones = OpcionesOperacion | undefined;

export const enviarWebhookSecret =
  (http: HttpClient) =>
  (options?: Opciones): Promise<Resultado<EnvioWebhookSecret>> =>
    http.get("/v1/me/webhook-secret", {
      schemaRespuesta: envioWebhookSecretSchema,
      signal: options?.signal,
      timeout: options?.timeout,
      // GET con efecto: envía un WhatsApp con el secreto; reenviarlo duplicaría el mensaje.
      reintentar: false,
    });
