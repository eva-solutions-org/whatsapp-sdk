import { ErrorConfiguracion } from "../errors/index.js";
import { crearHttpClient } from "../http-client/index.js";
import type { Autenticador, HttpClient, OpcionesReintentos } from "../http-client/index.js";
import { validarBaseUrl } from "./validar-base-url.js";

/**
 * Opciones comunes a los tres clientes (`.`, `./admin`, `./internal`).
 *
 * - `baseUrl`: requerido, origin del servicio (`https://host[:puerto]`; `http` solo en
 *   loopback). Sin credenciales, path, query ni fragmento.
 * - `timeout`: ms por intento (default 35_000: cubre la espera de QR de la API, hasta 30 s).
 * - `headers`: headers extra del consumidor; los de autenticación del SDK ganan.
 * - `fetch`: override (tracing, tests). Default `globalThis.fetch`.
 * - `signal`: AbortSignal global del cliente; cancela todas las operaciones en vuelo.
 * - `reintentos`: ver `OpcionesReintentos`.
 */
export interface OpcionesBaseCliente {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
  reintentos?: OpcionesReintentos;
}

const TIMEOUT_POR_DEFECTO_MS = 35_000;
const MAXIMO_REINTENTOS_PERMITIDO = 10;

const esNumeroNoNegativo = (valor: unknown): valor is number =>
  typeof valor === "number" && Number.isFinite(valor) && valor >= 0;

const validarReintentos = (reintentos: OpcionesReintentos | undefined): void => {
  if (reintentos === undefined) {
    return;
  }
  const { maximo, esperaBaseMs, esperaMaximaMs } = reintentos;
  if (
    maximo !== undefined &&
    !(Number.isInteger(maximo) && maximo >= 0 && maximo <= MAXIMO_REINTENTOS_PERMITIDO)
  ) {
    throw new ErrorConfiguracion(
      `reintentos.maximo debe ser un entero entre 0 y ${String(MAXIMO_REINTENTOS_PERMITIDO)}`,
    );
  }
  if (esperaBaseMs !== undefined && !esNumeroNoNegativo(esperaBaseMs)) {
    throw new ErrorConfiguracion("reintentos.esperaBaseMs debe ser un número >= 0");
  }
  if (esperaMaximaMs !== undefined && !esNumeroNoNegativo(esperaMaximaMs)) {
    throw new ErrorConfiguracion("reintentos.esperaMaximaMs debe ser un número >= 0");
  }
};

/**
 * Valida las opciones comunes y arma el http client con el autenticador dado.
 * Punto único de validación para los tres clientes.
 *
 * @throws {ErrorConfiguracion} `baseUrl`, `timeout` o `reintentos` inválidos.
 */
export const construirHttpClient = (
  opciones: OpcionesBaseCliente,
  autenticador: Autenticador,
): HttpClient => {
  const baseUrl = validarBaseUrl(opciones.baseUrl);

  const timeout = opciones.timeout ?? TIMEOUT_POR_DEFECTO_MS;
  if (typeof timeout !== "number" || !Number.isFinite(timeout) || timeout <= 0) {
    throw new ErrorConfiguracion("timeout debe ser un número > 0 (ms)");
  }
  validarReintentos(opciones.reintentos);

  return crearHttpClient({
    baseUrl,
    autenticador,
    timeout,
    headersExtra: opciones.headers,
    fetchImpl: opciones.fetch ?? globalThis.fetch,
    clientSignal: opciones.signal,
    reintentos: opciones.reintentos,
  });
};
