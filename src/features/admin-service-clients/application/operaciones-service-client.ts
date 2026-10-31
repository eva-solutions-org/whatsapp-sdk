import { segmentoRuta } from "../../../core/http-client/index.js";
import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import { mensajeConfirmacionSchema, validarEntrada } from "../../../core/validacion/index.js";
import type { MensajeConfirmacion, OpcionesOperacion } from "../../../core/validacion/index.js";
import { iterarCursor } from "../../../core/paginacion/index.js";
import {
  actualizarServiceClientInputSchema,
  crearServiceClientInputSchema,
  idServiceClientInputSchema,
  listaServiceClientsSchema,
  listarServiceClientsInputSchema,
  serviceClientSchema,
} from "../domain/index.js";
import type {
  ActualizarServiceClientInput,
  CrearServiceClientInput,
  IdServiceClientInput,
  ListaServiceClients,
  ListarServiceClientsInput,
  ServiceClient,
} from "../domain/index.js";

export const RUTA_SERVICE_CLIENTS = "/v1/admin/service-clients";

const rutaDe = (id: string): string => `${RUTA_SERVICE_CLIENTS}/${segmentoRuta(id)}`;

/**
 * POST /v1/admin/service-clients: crea el registro local de un service client de Auth, por su
 * id (el `sub` de sus tokens). No genera secreto ni permisos. 409 si el id ya está registrado.
 */
export const crearServiceClient =
  (http: HttpClient) =>
  async (
    entrada: CrearServiceClientInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<ServiceClient>> => {
    const validada = validarEntrada(crearServiceClientInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.post(RUTA_SERVICE_CLIENTS, validada.data, {
      schemaRespuesta: serviceClientSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };

/** GET /v1/admin/service-clients. Paginación por cursor. */
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

/** GET /v1/admin/service-clients/{id}. 404 si no existe. */
export const obtenerServiceClient =
  (http: HttpClient) =>
  async (
    entrada: IdServiceClientInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<ServiceClient>> => {
    const validada = validarEntrada(idServiceClientInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.get(rutaDe(validada.data.id), {
      schemaRespuesta: serviceClientSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };

/** PATCH /v1/admin/service-clients/{id} (parcial; sin ningún campo la API responde 400). */
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
    const { id, ...cuerpo } = validada.data;
    return http.patch(rutaDe(id), cuerpo, {
      schemaRespuesta: serviceClientSchema,
      signal: opciones?.signal,
      timeout: opciones?.timeout,
    });
  };

/**
 * DELETE /v1/admin/service-clients/{id} (hard delete del registro local; el service client sigue
 * existiendo en Auth).
 */
export const eliminarServiceClient =
  (http: HttpClient) =>
  async (
    entrada: IdServiceClientInput,
    opciones?: OpcionesOperacion,
  ): Promise<Resultado<MensajeConfirmacion>> => {
    const validada = validarEntrada(idServiceClientInputSchema, entrada);
    if (!validada.success) {
      return validada;
    }
    return http.delete(rutaDe(validada.data.id), {
      schemaRespuesta: mensajeConfirmacionSchema,
      // Un reintento tras un éxito perdido recibiría 404 y ocultaría el resultado real.
      reintentar: false,
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
