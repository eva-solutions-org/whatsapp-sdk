import { segmentoRuta } from "../../../core/http-client/index.js";
import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import { allowlistSchema, slugInputSchema, telefonoOrigenInputSchema } from "../domain/index.js";
import type { Allowlist, SlugInput, TelefonoOrigenInput } from "../domain/index.js";
import { RUTA_SERVICE_CLIENTS } from "./operaciones-service-client.js";

const rutaTelefonos = (slug: string): string =>
  `${RUTA_SERVICE_CLIENTS}/${segmentoRuta(slug)}/source-phones`;

/** GET /v1/admin/service-clients/{slug}/source-phones. Vacía = el client no puede enviar. */
export const listarTelefonosOrigen =
  (http: HttpClient) =>
  async (entrada: SlugInput, opciones?: OpcionesOperacion): Promise<Resultado<Allowlist>> => {
    const validada = validarEntrada(slugInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.get(rutaTelefonos(validada.data.slug), {
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
    const { slug, phone } = validada.data;
    return http.post(
      rutaTelefonos(slug),
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
    const { slug, phone } = validada.data;
    return http.delete(`${rutaTelefonos(slug)}/${segmentoRuta(phone)}`, {
      schemaRespuesta: allowlistSchema,
      // Un reintento tras un éxito perdido recibiría 404 y ocultaría el resultado real.
      reintentar: false,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };
