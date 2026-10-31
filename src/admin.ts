/**
 * Subpath `@eva_solutions/whatsapp-sdk/admin`: cliente de administración (`/v1/admin/*`),
 * autenticado con un token Bearer de servicio (`aud: whatsapp-api`, permiso `admin`) emitido por
 * Auth. El SDK no depende del auth-sdk: el consumidor pasa su proveedor de tokens.
 *
 * ```ts
 * const admin = crearClienteAdmin({
 *   baseUrl,
 *   obtenerToken: () => proveedor.getToken(),
 *   invalidarToken: proveedor.invalidate, // recibe el token rechazado
 * });
 * const r = await admin.serviceClients.listar();
 * ```
 *
 * Cada operación retorna `Promise<Resultado<T>>`. Ante un `401` se invoca `invalidarToken` y la
 * request se reintenta UNA vez con un token nuevo (también los POST: el 401 significa que el
 * servidor no la procesó); fuera de eso los POST no se reintentan. No incluye `/v1/admin/billing/webhook/pagos`: es el webhook entrante
 * del procesador de pagos, no una operación de administración.
 */

import { crearHttpClientConToken } from "./core/cliente/index.js";
import type { OpcionesClienteConToken } from "./core/cliente/index.js";
import { crearFacadeAuditoria } from "./features/admin-auditoria/index.js";
import type { FacadeAuditoria } from "./features/admin-auditoria/index.js";
import { crearFacadeBillingAdmin } from "./features/admin-billing/index.js";
import type { FacadeBillingAdmin } from "./features/admin-billing/index.js";
import { crearFacadeExencionPago } from "./features/admin-exencion-pago/index.js";
import type { FacadeExencionPago } from "./features/admin-exencion-pago/index.js";
import { crearFacadePagosAdmin } from "./features/admin-pagos/index.js";
import type { FacadePagosAdmin } from "./features/admin-pagos/index.js";
import { crearFacadeQrSistema } from "./features/admin-qr-sistema/index.js";
import type { FacadeQrSistema } from "./features/admin-qr-sistema/index.js";
import { crearFacadeServiceClients } from "./features/admin-service-clients/index.js";
import type { FacadeServiceClients } from "./features/admin-service-clients/index.js";
import { crearFacadeSesiones } from "./features/admin-sesiones/index.js";
import type { FacadeSesiones } from "./features/admin-sesiones/index.js";

/** Cliente `./admin`: un namespace por área. */
export interface ClienteAdmin {
  readonly qrSistema: FacadeQrSistema;
  readonly sesiones: FacadeSesiones;
  readonly auditoria: FacadeAuditoria;
  readonly billing: FacadeBillingAdmin;
  readonly pagos: FacadePagosAdmin;
  readonly exencionPago: FacadeExencionPago;
  readonly serviceClients: FacadeServiceClients;
}

/**
 * Crea el cliente de administración.
 *
 * `obtenerToken` entrega el token de servicio vigente (el proveedor lo cachea y renueva); el token
 * nunca aparece en mensajes de error.
 *
 * @throws {ErrorConfiguracion} `obtenerToken`, `invalidarToken`, `baseUrl`, `timeout` o
 *   `reintentos` inválidos (error de programación, no flujo de negocio).
 */
export const crearClienteAdmin = (opciones: OpcionesClienteConToken): ClienteAdmin => {
  const http = crearHttpClientConToken(opciones);
  return {
    qrSistema: crearFacadeQrSistema(http),
    sesiones: crearFacadeSesiones(http),
    auditoria: crearFacadeAuditoria(http),
    billing: crearFacadeBillingAdmin(http),
    pagos: crearFacadePagosAdmin(http),
    exencionPago: crearFacadeExencionPago(http),
    serviceClients: crearFacadeServiceClients(http),
  };
};

export { crearHttpClientConToken } from "./core/cliente/index.js";
export type { OpcionesClienteConToken } from "./core/cliente/index.js";
export type { HttpClient, RespuestaBinaria } from "./core/http-client/index.js";
export { ErrorConfiguracion } from "./core/errors/index.js";
export { esExitoso, esFallido } from "./core/types/index.js";
export type {
  CodigoErrorHttp,
  ErrorResultado,
  OrigenError,
  Resultado,
} from "./core/types/index.js";
export type { OpcionesOperacion } from "./core/validacion/index.js";

export type { FacadeAuditoria } from "./features/admin-auditoria/index.js";
export type {
  ListarLogsInput,
  ListarLogsRespuesta,
  LogAuditoria,
  ObtenerUsoInput,
  UsoApiKey,
} from "./features/admin-auditoria/index.js";
export type { FacadeBillingAdmin } from "./features/admin-billing/index.js";
export type {
  ActualizarPrecioInput,
  AjusteSaldo,
  AjustarSaldoInput,
  CambiarMonedaInput,
  CambioMoneda,
  ConfiguracionBilling,
  ConfigurarBillingInput,
  CrearPrecioInput,
  DesactivarPrecioInput,
  ListarMovimientosInput,
  ListarMovimientosRespuesta,
  MovimientoBilling,
  PrecioMoneda,
} from "./features/admin-billing/index.js";
export type { FacadeExencionPago } from "./features/admin-exencion-pago/index.js";
export type {
  AlternarExencionInput,
  Exencion,
  ExencionAplicada,
  HistorialExencion,
  HistorialExencionInput,
} from "./features/admin-exencion-pago/index.js";
export type { FacadePagosAdmin } from "./features/admin-pagos/index.js";
export type {
  PagoCancelacion,
  PagoConsultado,
  PagoIdInput,
  PagoReembolso,
  ReembolsarPagoInput,
} from "./features/admin-pagos/index.js";
export type { FacadeQrSistema } from "./features/admin-qr-sistema/index.js";
export type { ObtenerQrInput, QrSistema } from "./features/admin-qr-sistema/index.js";
export type { FacadeServiceClients } from "./features/admin-service-clients/index.js";
export type {
  ActualizarServiceClientInput,
  Allowlist,
  CrearServiceClientInput,
  IdServiceClientInput,
  ListaServiceClients,
  ListarServiceClientsInput,
  ServiceClient,
  TelefonoOrigenInput,
} from "./features/admin-service-clients/index.js";
export type { FacadeSesiones } from "./features/admin-sesiones/index.js";
export type { EliminarSesionInput } from "./features/admin-sesiones/index.js";
