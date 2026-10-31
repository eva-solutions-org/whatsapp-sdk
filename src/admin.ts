/**
 * Subpath `@eva_solutions/whatsapp-sdk/admin`: cliente de administración (`/v1/admin/*`),
 * firmado con HMAC S2S de un service client con scope `admin`.
 *
 * ```ts
 * const admin = crearClienteAdmin({ baseUrl, clientId, secretoHex });
 * const r = await admin.serviceClients.listar();
 * ```
 *
 * Cada operación retorna `Promise<Resultado<T>>`. Los POST no se reintentan (cada firma lleva un
 * nonce de un solo uso). No incluye `/v1/admin/billing/webhook/pagos`: es el webhook entrante
 * del procesador de pagos, no una operación de administración.
 */

import { crearHttpClientS2S } from "./core/cliente/index.js";
import type { OpcionesClienteS2S } from "./core/cliente/index.js";
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
 * `secretoHex` es el secreto del service client (hex); nunca aparece en mensajes de error.
 *
 * @throws {ErrorConfiguracion} `clientId`, `secretoHex`, `baseUrl`, `timeout` o `reintentos`
 *   inválidos (error de programación, no flujo de negocio).
 */
export const crearClienteAdmin = (opciones: OpcionesClienteS2S): ClienteAdmin => {
  const http = crearHttpClientS2S(opciones);
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

export { crearHttpClientS2S } from "./core/cliente/index.js";
export type { OpcionesClienteS2S } from "./core/cliente/index.js";
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
  ListaServiceClients,
  ListarServiceClientsInput,
  SecretRotado,
  ServiceClient,
  ServiceClientCreado,
  SlugInput,
  TelefonoOrigenInput,
} from "./features/admin-service-clients/index.js";
export type { FacadeSesiones } from "./features/admin-sesiones/index.js";
export type { EliminarSesionInput } from "./features/admin-sesiones/index.js";
