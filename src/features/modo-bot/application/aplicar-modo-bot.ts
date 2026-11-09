import { dormirAbortable, mapearErrorAbortExterno } from "../../../core/http-client/index.js";
import type { ErrorResultado, Resultado } from "../../../core/types/index.js";
import { telefonoSchema } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import type { FacadeChats } from "../../chats/index.js";
import type { ConfirmacionEnvio, FacadeMensajes } from "../../mensajes/index.js";
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

type EnvioConBot =
  | "enviarTexto"
  | "enviarImagen"
  | "enviarVideo"
  | "enviarGif"
  | "enviarPdf"
  | "enviarUbicacion";

type ConOpcionesBot<F> = F extends (input: infer I, ...resto: never[]) => infer R
  ? (input: I, opciones?: OpcionesEnvioBot) => R
  : never;

/**
 * `FacadeMensajes` con las opciones de envío ampliadas (`messageIds`). `enviarLote` no cambia:
 * el modo bot no actúa sobre lotes.
 */
export type FacadeMensajesBot = {
  [K in keyof FacadeMensajes]: K extends EnvioConBot
    ? ConOpcionesBot<FacadeMensajes[K]>
    : FacadeMensajes[K];
};

/** Costuras para tests deterministas (no son API pública). */
export interface CosturasModoBot {
  dormir?: (ms: number, signal?: AbortSignal) => Promise<void>;
  ahora?: () => number;
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

const telefonoDe = (input: unknown): string | undefined => {
  const phone = (input as { phone?: unknown } | null)?.phone;
  return telefonoSchema.safeParse(phone).success ? (phone as string) : undefined;
};

/**
 * Envuelve los envíos individuales de `mensajes` con el comportamiento de un humano. Antes de
 * cada envío, en este orden:
 *
 * 1. Verifica que el número tenga WhatsApp (caché por número; consultas simultáneas al mismo
 *    número comparten una sola llamada). Si no existe: 404 local, sin enviar. Si la consulta
 *    falla, según `config.siVerificacionFalla`: `"no_enviar"` devuelve un error local
 *    `verificacion_no_disponible` (conserva status y causa) y `"enviar"` avisa y sigue. Un fallo
 *    de verificación no se cachea.
 * 2. Si hay `messageIds`, los marca leídos.
 * 3. Muestra "escribiendo" y espera un tiempo proporcional al texto (con tope).
 * 4. Envía.
 *
 * Los pasos 2 y 3 son best-effort: si fallan se avisa por `alAdvertir` y el envío sigue. Un input
 * sin teléfono válido pasa directo al envío, que responde el 422 sin llamadas extra. `enviarLote`
 * no se toca.
 *
 * Cancelación: `signal` (el global del cliente) y `opciones.signal` cortan las esperas y devuelven
 * el error de abort sin enviar. La consulta compartida de existencia solo obedece al `signal`
 * global: si un llamador aborta, los demás reciben igual el resultado (y queda en caché).
 */
export const aplicarModoBot = ({
  mensajes,
  chats,
  config,
  signal: signalCliente,
  costuras = {},
}: {
  mensajes: FacadeMensajes;
  chats: FacadeChats;
  config: ConfigModoBot;
  signal?: AbortSignal | undefined;
  costuras?: CosturasModoBot;
}): FacadeMensajesBot => {
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
    phone: string,
    timeout: number | undefined,
  ): Promise<boolean | ErrorResultado> => {
    const enCurso = consultasEnCurso.get(phone);
    if (enCurso !== undefined) return enCurso;
    const consulta = chats
      .verificarExistencia({ phone }, { timeout })
      .then((r): boolean | ErrorResultado => {
        if (!r.success) return r;
        cache.guardar(phone, r.data.exists);
        return r.data.exists;
      })
      .finally(() => consultasEnCurso.delete(phone));
    consultasEnCurso.set(phone, consulta);
    return consulta;
  };

  /** Devuelve el error a retornar si no se debe enviar; `undefined` si se puede enviar. */
  const verificar = async (
    phone: string,
    timeout: number | undefined,
    signal: AbortSignal | undefined,
  ): Promise<ErrorResultado | undefined> => {
    let existe = cache.obtener(phone);
    if (existe === undefined) {
      const consulta = await hastaAbort(consultarExistencia(phone, timeout), signal);
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
    phone: string,
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
    const r = await chats.indicarEscritura(
      { phone, estado: "escribiendo", segundos: Math.max(1, Math.ceil(duracionMs / 1000)) },
      opciones,
    );
    if (!r.success) {
      if (!estaAbortado(signal)) advertir("escribir", r);
      return;
    }
    await dormir(duracionMs, signal);
  };

  const conModoBot =
    <I>(
      enviar: (input: I, opciones?: OpcionesOperacion) => Promise<Resultado<ConfirmacionEnvio>>,
      textoDe: (input: I) => string | undefined,
    ) =>
    async (input: I, opciones?: OpcionesEnvioBot): Promise<Resultado<ConfirmacionEnvio>> => {
      const { messageIds, ...opcionesOperacion } = opciones ?? {};
      const phone = telefonoDe(input);
      if (phone === undefined) return enviar(input, opcionesOperacion);

      // Las esperas del bot escuchan tanto el signal global del cliente como el de la operación.
      const senales = [signalCliente, opcionesOperacion.signal].filter((s) => s !== undefined);
      const signal = senales.length > 0 ? AbortSignal.any(senales) : undefined;

      if (estaAbortado(signal)) return mapearErrorAbortExterno();
      if (config.verificarExistencia) {
        const noEnviar = await verificar(phone, opcionesOperacion.timeout, signal);
        if (noEnviar !== undefined) return noEnviar;
      }
      if (messageIds !== undefined && messageIds.length > 0) {
        const r = await chats.marcarLeido({ phone, messageIds }, opcionesOperacion);
        if (!r.success && !estaAbortado(signal)) advertir("leer", r);
      }
      await escribir(phone, textoDe(input), opcionesOperacion, signal);
      if (estaAbortado(signal)) return mapearErrorAbortExterno();
      return enviar(input, opcionesOperacion);
    };

  return {
    ...mensajes,
    enviarTexto: conModoBot(mensajes.enviarTexto, (i) => i.message),
    enviarImagen: conModoBot(mensajes.enviarImagen, (i) => i.caption),
    enviarVideo: conModoBot(mensajes.enviarVideo, (i) => i.caption),
    enviarGif: conModoBot(mensajes.enviarGif, (i) => i.caption),
    enviarPdf: conModoBot(mensajes.enviarPdf, (i) => i.caption),
    enviarUbicacion: conModoBot(mensajes.enviarUbicacion, () => undefined),
  };
};
