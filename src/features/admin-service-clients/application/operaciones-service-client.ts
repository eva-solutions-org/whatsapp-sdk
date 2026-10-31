import { segmentoRuta } from "../../../core/http-client/index.js";
import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { mensajeConfirmacionSchema, validarEntrada } from "../../../core/validacion/index.js";
import type { MensajeConfirmacion, OpcionesOperacion } from "../../../core/validacion/index.js";
import { iterarCursor } from "../../../core/paginacion/index.js";
import {
  actualizarServiceClientInputSchema,
  crearServiceClientInputSchema,
  listaServiceClientsSchema,
  listarServiceClientsInputSchema,
  secretRotadoSchema,
  serviceClientCreadoSchema,
  serviceClientSchema,
  slugInputSchema,
} from "../domain/index.js";
import type {
  ActualizarServiceClientInput,
  CrearServiceClientInput,
  ListaServiceClients,
  ListarServiceClientsInput,
  SecretRotado,
  ServiceClient,
  ServiceClientCreado,
  SlugInput,
} from "../domain/index.js";

export const RUTA_SERVICE_CLIENTS = "/v1/admin/service-clients";

const rutaDe = (slug: string): string => `${RUTA_SERVICE_CLIENTS}/${segmentoRuta(slug)}`;

/**
 * POST /v1/admin/service-clients. 409 si el slug ya existe. La respuesta incluye `secret` en
 * texto plano: es la única vez que se expone, guárdalo de inmediato.
 */
export const crearServiceClient =
  (http: HttpClient) =>
  async (
    entrada: CrearServiceClientInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<ServiceClientCreado>> => {
    const validada = validarEntrada(crearServiceClientInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.post(RUTA_SERVICE_CLIENTS, validada.data, {
      schemaRespuesta: serviceClientCreadoSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };

/** GET /v1/admin/service-clients. Paginación por cursor; los items no traen el secret. */
export const listarServiceClients =
  (http: HttpClient) =>
  async (
    entrada: ListarServiceClientsInput = {},
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<ListaServiceClients>> => {
    const validada = validarEntrada(listarServiceClientsInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.get(RUTA_SERVICE_CLIENTS, {
      query: validada.data,
      schemaRespuesta: listaServiceClientsSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };

/** GET /v1/admin/service-clients/{slug}. 404 si no existe. */
export const obtenerServiceClient =
  (http: HttpClient) =>
  async (entrada: SlugInput, opciones?: OpcionesOperacion): Promise<Resultado<ServiceClient>> => {
    const validada = validarEntrada(slugInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.get(rutaDe(validada.data.slug), {
      schemaRespuesta: serviceClientSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };

/**
 * PATCH /v1/admin/service-clients/{slug} (parcial; sin ningún campo la API responde 400).
 * 409 si deshabilitarlo o quitarle el scope `admin` deja al sistema sin un admin habilitado.
 */
export const actualizarServiceClient =
  (http: HttpClient) =>
  async (
    entrada: ActualizarServiceClientInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<ServiceClient>> => {
    const validada = validarEntrada(actualizarServiceClientInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    const { slug, ...cuerpo } = validada.data;
    return http.patch(rutaDe(slug), cuerpo, {
      schemaRespuesta: serviceClientSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };

/**
 * DELETE /v1/admin/service-clients/{slug} (hard delete). 409 si es el último service client
 * admin habilitado; 400 para la fila reservada `auth-service`.
 */
export const eliminarServiceClient =
  (http: HttpClient) =>
  async (
    entrada: SlugInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<MensajeConfirmacion>> => {
    const validada = validarEntrada(slugInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.delete(rutaDe(validada.data.slug), {
      schemaRespuesta: mensajeConfirmacionSchema,
      // Un reintento tras un éxito perdido recibiría 404 y ocultaría el resultado real.
      reintentar: false,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };

/**
 * POST /v1/admin/service-clients/{slug}/rotate-secret. El secret anterior deja de funcionar
 * al instante (sin ventana de solape); el nuevo viene en texto plano solo en esta respuesta.
 * 400 para la fila `auth-service` (firma con JWT, no tiene secret HMAC).
 */
export const rotarSecretServiceClient =
  (http: HttpClient) =>
  async (entrada: SlugInput, opciones?: OpcionesOperacion): Promise<Resultado<SecretRotado>> => {
    const validada = validarEntrada(slugInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.post(`${rutaDe(validada.data.slug)}/rotate-secret`, undefined, {
      schemaRespuesta: secretRotadoSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };

/** Recorre todos los service clients, página a página. Ante un fallo lanza un `Error` con el `Resultado` en `cause`. */
export const iterarServiceClients =
  (http: HttpClient) =>
  (entrada: Omit<ListarServiceClientsInput, "cursor"> = {}, opciones?: OpcionesOperacion) =>
    iterarCursor(
      (cursor) => listarServiceClients(http)({ ...entrada, cursor }, opciones),
      (lista) => ({ items: lista.data, siguiente: lista.nextCursor }),
    );
