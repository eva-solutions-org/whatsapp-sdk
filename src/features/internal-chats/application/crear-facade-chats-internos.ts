import type { HttpClient } from "../../../core/http-client/index.js";
import { segmentoRuta } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { mensajeConfirmacionSchema, validarEntrada } from "../../../core/validacion/index.js";
import type { MensajeConfirmacion, OpcionesOperacion } from "../../../core/validacion/index.js";
import {
  existenciaNumeroInternoSchema,
  indicarEscrituraInternoInputSchema,
  verificarExistenciaInternoInputSchema,
} from "../domain/index.js";
import type {
  ExistenciaNumeroInterno,
  IndicarEscrituraInternoInput,
  VerificarExistenciaInternoInput,
} from "../domain/index.js";

/**
 * Primitivas de chat de la vía interna (`/v1/internal/chats/*`), con token Bearer de servicio.
 * No cobran. Las usa el modo bot de `crearClienteInterno`, pero también se pueden llamar sueltas.
 * Valen los mismos errores que el envío interno: `401` (reintentado una vez con token nuevo),
 * `403` (permiso, `sub` sin registro o `sourcePhone` fuera de la allowlist, `source_phone_not_allowed`),
 * `422`, `429` (`retryAfter`) y `503`. El POST de `typing` solo se reintenta ante el `401`; el GET de
 * `exists` además sigue la política de reintentos del http client.
 */
export const crearFacadeChatsInternos = (http: HttpClient) => ({
  /**
   * Consulta si `phone` tiene cuenta de WhatsApp (`GET /v1/internal/chats/{phone}/exists`),
   * desde la sesión de `sourcePhone`. La API cachea 6 h por número y responde 429 al pasar de
   * 120 consultas por hora por número remitente (cupo compartido con la vía pública): cachea del
   * lado del llamador (el modo bot ya lo hace).
   */
  verificarExistencia: async (
    input: VerificarExistenciaInternoInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<ExistenciaNumeroInterno>> => {
    const valido = validarEntrada(verificarExistenciaInternoInputSchema, input);
    if (!valido.success) return valido;
    const { phone, sourcePhone } = valido.data;
    return http.get(`/v1/internal/chats/${segmentoRuta(phone)}/exists`, {
      query: { sourcePhone },
      schemaRespuesta: existenciaNumeroInternoSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  },

  /**
   * Muestra "escribiendo" / "grabando" en el chat (`POST /v1/internal/chats/{phone}/typing`).
   * Con `segundos` (1 a 25) el indicador vuelve a "pausa" solo; con `estado: "pausa"` se quita.
   * No se reintenta (un POST), salvo el `401`.
   */
  indicarEscritura: async (
    input: IndicarEscrituraInternoInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<MensajeConfirmacion>> => {
    const valido = validarEntrada(indicarEscrituraInternoInputSchema, input);
    if (!valido.success) return valido;
    const { phone, ...cuerpo } = valido.data;
    return http.post(`/v1/internal/chats/${segmentoRuta(phone)}/typing`, cuerpo, {
      schemaRespuesta: mensajeConfirmacionSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  },
});

export type FacadeChatsInternos = ReturnType<typeof crearFacadeChatsInternos>;
