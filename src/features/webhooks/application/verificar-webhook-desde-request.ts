import type { Resultado } from "../../../core/types/index.js";
import {
  TIPOS_EVENTO_WEBHOOK,
  clasificarEvento,
  eventoWebhookSchema,
} from "../../notificaciones/index.js";
import type { EventoWebhookRecibido } from "../../notificaciones/index.js";
import { HEADER_FIRMA_WEBHOOK, MAX_BYTES_CUERPO_WEBHOOK } from "../domain/index.js";
import type { OpcionesVerificarRequest } from "../domain/index.js";
import { leerCuerpoLimitado } from "../infrastructure/index.js";
import { verificarFirmaWebhook } from "./verificar-firma-webhook.js";

const codificador = new TextEncoder();

/**
 * Verifica y tipa un webhook recibido como `Request` estándar (Hono, Workers, Next, Bun).
 *
 * Códigos (Result Pattern, no lanza):
 *   - Header `X-Webhook-Signature` ausente -> 401.
 *   - Firma inválida / secreto vacío -> 401 (propagado de `verificarFirmaWebhook`).
 *   - Cuerpo mayor a `maxBytesCuerpo` -> 413.
 *   - Body ya consumido, no JSON o evento conocido con forma inválida (la firma SÍ era válida) -> 422.
 *   - `type` desconocido con firma válida NO es error (forward-compat): se entrega como
 *     `EventoDesconocido` (`conocido: false`).
 *
 * Si el framework ya consumió el stream, pasa `opciones.cuerpoCrudo`: se usa tal cual y no
 * se toca `request.body`.
 */
export const verificarWebhookDesdeRequest = async (
  request: Request,
  secreto: string,
  opciones: OpcionesVerificarRequest = {},
): Promise<Resultado<{ evento: EventoWebhookRecibido }>> => {
  const maxBytes = opciones.maxBytesCuerpo ?? MAX_BYTES_CUERPO_WEBHOOK;

  const firma = request.headers.get(HEADER_FIRMA_WEBHOOK);
  if (firma === null) {
    return {
      success: false,
      error: `Header ${HEADER_FIRMA_WEBHOOK} ausente`,
      codigo: 401,
      origen: "local",
    };
  }

  let cuerpo: Uint8Array;
  if (opciones.cuerpoCrudo !== undefined) {
    cuerpo =
      typeof opciones.cuerpoCrudo === "string"
        ? codificador.encode(opciones.cuerpoCrudo)
        : opciones.cuerpoCrudo;
    if (cuerpo.byteLength > maxBytes) {
      return { success: false, error: "Body demasiado grande", codigo: 413, origen: "local" };
    }
  } else {
    const leido = await leerCuerpoLimitado(request, maxBytes);
    if (!leido.success) {
      return leido;
    }
    cuerpo = leido.data;
  }

  const verificacion = await verificarFirmaWebhook({ cuerpoCrudo: cuerpo, firma, secreto });
  if (!verificacion.success) {
    return verificacion;
  }

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(cuerpo));
  } catch {
    return { success: false, error: "Body no es JSON válido", codigo: 422, origen: "local" };
  }

  const clasificado = clasificarEvento(json, eventoWebhookSchema, TIPOS_EVENTO_WEBHOOK);
  if (!clasificado.ok) {
    return {
      success: false,
      error: "Evento de webhook con forma inválida",
      codigo: 422,
      origen: "local",
      detalles: clasificado.detalles ?? clasificado.error,
    };
  }
  return { success: true, data: { evento: clasificado.evento } };
};
