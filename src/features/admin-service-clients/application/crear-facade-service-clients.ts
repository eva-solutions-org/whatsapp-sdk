import type { HttpClient } from "../../../core/http-client/index.js";
import {
  actualizarServiceClient,
  crearServiceClient,
  eliminarServiceClient,
  iterarServiceClients,
  listarServiceClients,
  obtenerServiceClient,
  rotarSecretServiceClient,
} from "./operaciones-service-client.js";
import {
  agregarTelefonoOrigen,
  listarTelefonosOrigen,
  quitarTelefonoOrigen,
} from "./operaciones-telefonos-origen.js";

/** Service clients (credenciales S2S) y la allowlist de teléfonos remitentes de cada uno. */
export const crearFacadeServiceClients = (http: HttpClient) => ({
  /** Crea un client. La respuesta trae su `secret` en texto plano, una única vez. */
  crear: crearServiceClient(http),
  listar: listarServiceClients(http),
  /** Recorre todos los clients (async iterator). */
  iterar: iterarServiceClients(http),
  obtener: obtenerServiceClient(http),
  actualizar: actualizarServiceClient(http),
  /** Hard delete. */
  eliminar: eliminarServiceClient(http),
  /** Genera un secret nuevo; el anterior deja de servir al instante. */
  rotarSecret: rotarSecretServiceClient(http),
  /** Allowlist de `sourcePhone` desde los que el client puede enviar en `./internal`. */
  telefonosOrigen: {
    listar: listarTelefonosOrigen(http),
    agregar: agregarTelefonoOrigen(http),
    quitar: quitarTelefonoOrigen(http),
  },
});

export type FacadeServiceClients = ReturnType<typeof crearFacadeServiceClients>;
