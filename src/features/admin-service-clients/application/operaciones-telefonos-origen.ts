import { segmentoRuta } from "../../../core/http-client/index.js";
import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import {
  allowlistSchema,
  idServiceClientInputSchema,
  telefonoOrigenInputSchema,
} from "../domain/index.js";
import type { Allowlist, IdServiceClientInput, TelefonoOrigenInput } from "../domain/index.js";
import { RUTA_SERVICE_CLIENTS } from "./operaciones-service-client.js";

const rutaTelefonos = (id: string): string =>
  `${RUTA_SERVICE_CLIENTS}/${segmentoRuta(id)}/source-phones`;

/** GET /v1/admin/service-clients/{id}/source-phones. Vacía = el client no puede enviar. */
export const listarTelefonosOrigen =
  (http: HttpClient) =>
  async (
    entrada: IdServiceClientInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<Allowlist>> => {
    const validada = validarEntrada(idServiceClientInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.get(rutaTelefonos(validada.data.id), {
      schemaRespuesta: allowlistSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };

/** POST .../source-phones. Idempotente: agregar un número ya asignado devuelve la lista igual. */
export const agregarTelefonoOrigen =
  (http: HttpClient) =>
  async (
    entrada: TelefonoOrigenInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<Allowlist>> => {
    const validada = validarEntrada(telefonoOrigenInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    const { id, phone } = validada.data;
    return http.post(
      rutaTelefonos(id),
      { phone },
      { schemaRespuesta: allowlistSchema, signal: opciones?.signal, timeout: opciones?.timeout },
    );
  };

/** DELETE .../source-phones/{phone}. Idempotente: quitar un número no asignado devuelve la lista igual. */
export const quitarTelefonoOrigen =
  (http: HttpClient) =>
  async (
    entrada: TelefonoOrigenInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<Allowlist>> => {
    const validada = validarEntrada(telefonoOrigenInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    const { id, phone } = validada.data;
    return http.delete(`${rutaTelefonos(id)}/${segmentoRuta(phone)}`, {
      schemaRespuesta: allowlistSchema,
      // Un reintento tras un éxito perdido recibiría 404 y ocultaría el resultado real.
      reintentar: false,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };
