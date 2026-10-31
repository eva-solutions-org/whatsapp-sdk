import type { HttpClient } from "../../../core/http-client/index.js";
import {
  actualizarServiceClient,
  crearServiceClient,
  eliminarServiceClient,
  iterarServiceClients,
  listarServiceClients,
  obtenerServiceClient,
} from "./operaciones-service-client.js";
import {
  agregarTelefonoOrigen,
  listarTelefonosOrigen,
  quitarTelefonoOrigen,
} from "./operaciones-telefonos-origen.js";

/**
 * Registro local de service clients de Whatsapp-api (sin secreto ni permisos: viven en Auth) y la
 * allowlist de teléfonos remitentes de cada uno. Se identifican por el id de Auth (`sub` del token).
 */
export const crearFacadeServiceClients = (http: HttpClient) => ({
  /** Registra un service client de Auth (por su id) para usar `./internal`. */
  crear: crearServiceClient(http),
  listar: listarServiceClients(http),
  /** Recorre todos los clients (async iterator). */
  iterar: iterarServiceClients(http),
  obtener: obtenerServiceClient(http),
  actualizar: actualizarServiceClient(http),
  /** Hard delete. */
  eliminar: eliminarServiceClient(http),
  /** Allowlist de `sourcePhone` desde los que el client puede enviar en `./internal`. */
  telefonosOrigen: {
    listar: listarTelefonosOrigen(http),
    agregar: agregarTelefonoOrigen(http),
    quitar: quitarTelefonoOrigen(http),
  },
});

export type FacadeServiceClients = ReturnType<typeof crearFacadeServiceClients>;
