import type { HttpClient } from "../../../core/http-client/index.js";
import { segmentoRuta } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { mensajeConfirmacionSchema, validarEntrada } from "../../../core/validacion/index.js";
import type { MensajeConfirmacion, OpcionesOperacion } from "../../../core/validacion/index.js";
import {
  cambiarPresenciaInputSchema,
  existenciaNumeroSchema,
  indicarEscrituraInputSchema,
  marcarLeidoInputSchema,
  verificarExistenciaInputSchema,
} from "../domain/chats-schemas.js";
import type {
  CambiarPresenciaInput,
  ExistenciaNumero,
  IndicarEscrituraInput,
  MarcarLeidoInput,
  VerificarExistenciaInput,
} from "../domain/chats-schemas.js";

type Opciones = OpcionesOperacion | undefined;

/**
 * Muestra "escribiendo" / "grabando" en el chat (`POST /v1/chats/{phone}/typing`). Con `segundos`
 * (1 a 25) el indicador vuelve a "pausa" solo; con `estado: "pausa"` se quita y `segundos` se
 * ignora. No se reintenta (un POST). No cobra.
 */
export const indicarEscritura =
  (http: HttpClient) =>
  async (
    input: IndicarEscrituraInput,
    options?: Opciones,
  ): Promise<Resultado<MensajeConfirmacion>> => {
    const valido = validarEntrada(indicarEscrituraInputSchema, input);
    if (!valido.success) return valido;
    const { phone, ...cuerpo } = valido.data;
    return http.post(`/v1/chats/${segmentoRuta(phone)}/typing`, cuerpo, {
      schemaRespuesta: mensajeConfirmacionSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };

/**
 * Consulta si el número tiene cuenta de WhatsApp (`GET /v1/chats/{phone}/exists`). La API cachea
 * el resultado 6 h por número y responde 429 al pasar de 120 consultas por hora por número
 * remitente: cachea del lado del llamador (el modo bot ya lo hace).
 */
export const verificarExistencia =
  (http: HttpClient) =>
  async (
    input: VerificarExistenciaInput,
    options?: Opciones,
  ): Promise<Resultado<ExistenciaNumero>> => {
    const valido = validarEntrada(verificarExistenciaInputSchema, input);
    if (!valido.success) return valido;
    return http.get(`/v1/chats/${segmentoRuta(valido.data.phone)}/exists`, {
      schemaRespuesta: existenciaNumeroSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };

/**
 * Marca como leídos mensajes entrantes (`POST /v1/chats/{phone}/read`). `messageIds` son los
 * `data.messageId` de los eventos `message` recibidos por webhook o WebSocket (1 a 50). WhatsApp
 * no avisa si un id no existe: la API responde 200 igual. Solo chats individuales.
 */
export const marcarLeido =
  (http: HttpClient) =>
  async (input: MarcarLeidoInput, options?: Opciones): Promise<Resultado<MensajeConfirmacion>> => {
    const valido = validarEntrada(marcarLeidoInputSchema, input);
    if (!valido.success) return valido;
    return http.post(
      `/v1/chats/${segmentoRuta(valido.data.phone)}/read`,
      { messageIds: valido.data.messageIds },
      {
        schemaRespuesta: mensajeConfirmacionSchema,
        signal: options?.signal,
        timeout: options?.timeout,
      },
    );
  };

/** Presencia global de la cuenta remitente (`POST /v1/presence`): `en_linea` o `desconectado`. */
export const cambiarPresencia =
  (http: HttpClient) =>
  async (
    input: CambiarPresenciaInput,
    options?: Opciones,
  ): Promise<Resultado<MensajeConfirmacion>> => {
    const valido = validarEntrada(cambiarPresenciaInputSchema, input);
    if (!valido.success) return valido;
    return http.post("/v1/presence", valido.data, {
      schemaRespuesta: mensajeConfirmacionSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };
