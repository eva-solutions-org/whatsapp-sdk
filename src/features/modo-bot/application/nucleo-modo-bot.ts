import { dormirAbortable, mapearErrorAbortExterno } from "../../../core/http-client/index.js";
import type { ErrorResultado, Resultado } from "../../../core/types/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import { calcularDuracionEscritura } from "../domain/index.js";
import type { ConfigModoBot, PasoBot } from "../domain/index.js";
import { crearCacheExistencia } from "./cache-existencia.js";

/** `codigoApi` del error local que devuelve el modo bot si el número no tiene WhatsApp. */
export const CODIGO_NUMERO_SIN_WHATSAPP = "numero_sin_whatsapp";

/**
 * `codigoApi` del error local que devuelve el modo bot (con `siVerificacionFalla: "no_enviar"`)
 * cuando no pudo verificar el número. No se envió nada: reintentar es seguro.
 */
export const CODIGO_VERIFICACION_NO_DISPONIBLE = "verificacion_no_disponible";

/** Opciones de un envío en modo bot: las de siempre más los mensajes entrantes a marcar leídos. */
export interface OpcionesEnvioBot extends OpcionesOperacion {
  /**
   * `data.messageId` de los mensajes del contacto que se están respondiendo (1 a 50): se marcan
   * como leídos antes de escribir. Solo tiene efecto en modo bot.
   */
  messageIds?: string[];
}

/** Costuras para tests deterministas (no son API pública). */
export interface CosturasModoBot {
  dormir?: (ms: number, signal?: AbortSignal) => Promise<void>;
  ahora?: () => number;
}

/**
 * Las llamadas de chat de UN envío, ya ligadas a su destino (y, en la vía interna, a su
 * `sourcePhone`). Cada fachada (pública o interna) arma las suyas; el núcleo no conoce rutas.
 */
export interface ContextoBot {
  /** Destino del envío: llave de la caché de resultados. */
  phone: string;
  /**
   * Llave de las consultas de existencia en vuelo (default: `phone`). La vía interna la separa por
   * remitente: un `sourcePhone` sin allowlist, sesión o cupo no debe contagiar su error a otro.
   */
  claveConsulta?: string;
  verificarExistencia: (opciones: OpcionesOperacion) => Promise<Resultado<{ exists: boolean }>>;
  indicarEscritura: (segundos: number, opciones: OpcionesOperacion) => Promise<Resultado<unknown>>;
  /** Ausente si la fachada no puede marcar leído (vía interna): `messageIds` se ignora. */
  marcarLeido?: (messageIds: string[], opciones: OpcionesOperacion) => Promise<Resultado<unknown>>;
}

const errorNumeroSinWhatsapp = (): ErrorResultado => ({
  success: false,
  error: "El número no tiene cuenta de WhatsApp; el mensaje no se envió",
  codigo: 404,
  origen: "local",
  codigoApi: CODIGO_NUMERO_SIN_WHATSAPP,
});

/** Conserva `codigo`, `origen`, `retryAfter` y demás datos de la causa; solo cambia mensaje y `codigoApi`. */
const errorVerificacionNoDisponible = (causa: ErrorResultado): ErrorResultado => ({
  ...causa,
  error: `No se pudo verificar que el número tenga WhatsApp; el mensaje no se envió y se puede reintentar (${causa.error})`,
  codigoApi: CODIGO_VERIFICACION_NO_DISPONIBLE,
});

/** Función aparte para que TypeScript no dé por fijo el valor de `aborted` a través de los `await`. */
const estaAbortado = (signal: AbortSignal | undefined): boolean => signal?.aborted === true;

/** Espera `promesa`, pero se resuelve con el error de abort apenas `signal` aborta (sin cancelar `promesa`). */
const hastaAbort = <T>(
  promesa: Promise<T>,
  signal: AbortSignal | undefined,
): Promise<T | ErrorResultado> => {
  if (signal === undefined) return promesa;
  return new Promise((resolver) => {
    if (signal.aborted) {
      resolver(mapearErrorAbortExterno());
      return;
    }
    const alAbortar = () => resolver(mapearErrorAbortExterno());
    signal.addEventListener("abort", alAbortar, { once: true });
    void promesa.then((valor) => {
      signal.removeEventListener("abort", alAbortar);
      resolver(valor);
    });
  });
};

/**
 * Núcleo del modo bot, común a la fachada pública y a la interna. Antes de cada envío, en este
 * orden:
 *
 * 1. Verifica que el número tenga WhatsApp (caché por número; consultas simultáneas al mismo
 *    número comparten una sola llamada). Si no existe: 404 local, sin enviar. Si la consulta
 *    falla, según `config.siVerificacionFalla`: `"no_enviar"` devuelve un error local
 *    `verificacion_no_disponible` (conserva status y causa) y `"enviar"` avisa y sigue. Un fallo
 *    de verificación no se cachea.
 * 2. Si hay `messageIds` y el contexto sabe marcar leído, los marca leídos.
 * 3. Muestra "escribiendo" y espera un tiempo proporcional al texto (con tope).
 * 4. Envía.
 *
 * Los pasos 2 y 3 son best-effort: si fallan se avisa por `alAdvertir` y el envío sigue. Un input
 * sin contexto (teléfono inválido) pasa directo al envío, que responde el 422 sin llamadas extra.
 *
 * Cancelación: `signal` (el global del cliente) y `opciones.signal` cortan las esperas y devuelven
 * el error de abort sin enviar. La consulta compartida de existencia solo obedece al `signal`
 * global: si un llamador aborta, los demás reciben igual el resultado (y queda en caché).
 *
 * La caché y las consultas en vuelo son del núcleo (una instancia por cliente).
 */
export const crearNucleoModoBot = ({
  config,
  signal: signalCliente,
  costuras = {},
}: {
  config: ConfigModoBot;
  signal?: AbortSignal | undefined;
  costuras?: CosturasModoBot;
}) => {
  const dormir = costuras.dormir ?? dormirAbortable;
  const cache = crearCacheExistencia({
    ttlExisteMs: config.ttlExisteMs,
    ttlInexistenteMs: config.ttlInexistenteMs,
    ahora: costuras.ahora ?? Date.now,
  });
  const consultasEnCurso = new Map<string, Promise<boolean | ErrorResultado>>();

  const advertir = (paso: PasoBot, error: ErrorResultado): void => {
    try {
      config.alAdvertir?.({ paso, error });
    } catch {
      // Un callback del consumidor que lanza no debe impedir el envío.
    }
  };

  // La consulta compartida no usa la `signal` de la operación (solo la global, vía el http client):
  // si quien la inició aborta, los demás siguen esperando un resultado. Usa el `timeout` del
  // primer llamador y guarda en caché el resultado aunque nadie siga esperando.
  const consultarExistencia = (
    contexto: ContextoBot,
    timeout: number | undefined,
  ): Promise<boolean | ErrorResultado> => {
    const { phone } = contexto;
    const clave = contexto.claveConsulta ?? phone;
    const enCurso = consultasEnCurso.get(clave);
    if (enCurso !== undefined) return enCurso;
    const consulta = contexto
      .verificarExistencia({ timeout })
      .then((r): boolean | ErrorResultado => {
        if (!r.success) return r;
        cache.guardar(phone, r.data.exists);
        return r.data.exists;
      })
      .finally(() => consultasEnCurso.delete(clave));
    consultasEnCurso.set(clave, consulta);
    return consulta;
  };

  /** Devuelve el error a retornar si no se debe enviar; `undefined` si se puede enviar. */
  const verificar = async (
    contexto: ContextoBot,
    timeout: number | undefined,
    signal: AbortSignal | undefined,
  ): Promise<ErrorResultado | undefined> => {
    let existe = cache.obtener(contexto.phone);
    if (existe === undefined) {
      const consulta = await hastaAbort(consultarExistencia(contexto, timeout), signal);
      if (estaAbortado(signal)) return mapearErrorAbortExterno();
      if (typeof consulta !== "boolean") {
        if (config.siVerificacionFalla === "no_enviar") {
          return errorVerificacionNoDisponible(consulta);
        }
        advertir("verificar", consulta);
        return undefined;
      }
      existe = consulta;
    }
    return existe ? undefined : errorNumeroSinWhatsapp();
  };

  const escribir = async (
    contexto: ContextoBot,
    texto: string | undefined,
    opciones: OpcionesOperacion,
    signal: AbortSignal | undefined,
  ): Promise<void> => {
    const duracionMs = calcularDuracionEscritura({
      largoTexto: texto === undefined || texto.length === 0 ? undefined : texto.length,
      escritura: config.escritura,
      aleatorio: config.aleatorio,
    });
    if (duracionMs <= 0) return;
    const r = await contexto.indicarEscritura(Math.max(1, Math.ceil(duracionMs / 1000)), opciones);
    if (!r.success) {
      if (!estaAbortado(signal)) advertir("escribir", r);
      return;
    }
    await dormir(duracionMs, signal);
  };

  /**
   * Envuelve un envío. `contextoDe` devuelve las llamadas de chat del input, o `undefined` si el
   * input no tiene un destino válido (pasa directo al envío).
   */
  const envolver =
    <I, R>(
      enviar: (input: I, opciones?: OpcionesOperacion) => Promise<Resultado<R>>,
      textoDe: (input: I) => string | undefined,
      contextoDe: (input: I) => ContextoBot | undefined,
    ) =>
    async (input: I, opciones?: OpcionesEnvioBot): Promise<Resultado<R>> => {
      const { messageIds, ...opcionesOperacion } = opciones ?? {};
      const contexto = contextoDe(input);
      if (contexto === undefined) return enviar(input, opcionesOperacion);

      // Las esperas del bot escuchan tanto el signal global del cliente como el de la operación.
      const senales = [signalCliente, opcionesOperacion.signal].filter((s) => s !== undefined);
      const signal = senales.length > 0 ? AbortSignal.any(senales) : undefined;

      if (estaAbortado(signal)) return mapearErrorAbortExterno();
      if (config.verificarExistencia) {
        const noEnviar = await verificar(contexto, opcionesOperacion.timeout, signal);
        if (noEnviar !== undefined) return noEnviar;
      }
      if (contexto.marcarLeido !== undefined && messageIds !== undefined && messageIds.length > 0) {
        const r = await contexto.marcarLeido(messageIds, opcionesOperacion);
        if (!r.success && !estaAbortado(signal)) advertir("leer", r);
      }
      await escribir(contexto, textoDe(input), opcionesOperacion, signal);
      if (estaAbortado(signal)) return mapearErrorAbortExterno();
      return enviar(input, opcionesOperacion);
    };

  return { envolver };
};
