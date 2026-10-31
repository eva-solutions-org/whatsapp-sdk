/** Contrato público del feature `admin-service-clients`. Los schemas Zod son internos. */

export { crearFacadeServiceClients } from "./application/index.js";
export type { FacadeServiceClients } from "./application/index.js";
export type {
  ActualizarServiceClientInput,
  Allowlist,
  CrearServiceClientInput,
  ListaServiceClients,
  ListarServiceClientsInput,
  SecretRotado,
  ServiceClient,
  ServiceClientCreado,
  SlugInput,
  TelefonoOrigenInput,
} from "./domain/index.js";
