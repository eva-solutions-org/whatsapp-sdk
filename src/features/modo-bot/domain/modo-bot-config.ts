import { ErrorConfiguracion } from "../../../core/errors/index.js";
import type { ErrorResultado } from "../../../core/types/index.js";

/**
 * Qué hacer cuando la verificación de un número NO cacheado falla (429, 503 u otro error de
 * red/API; un `exists: false` no es un fallo).
 */
export type PoliticaFalloVerificacion = "no_enviar" | "enviar";

/** Paso del modo bot que falló sin impedir el envío (ver `OpcionesModoBot.alAdvertir`). */
export type PasoBot = "verificar" | "leer" | "escribir";

export interface AdvertenciaBot {
  paso: PasoBot;
  error: ErrorResultado;
}

/**
 * Tiempo que el modo bot muestra "escribiendo" antes de un envío. Todos los valores en ms salvo
 * `variacion`.
 *
 * - Texto: `baseMs + msPorCaracter * largo`.
 * - Media o ubicación sin texto: `mediaMs`.
 * - A ese valor (ya recortado a `topeMs`) se le aplica `± variacion` (fracción 0 a 1) al azar, de
 *   modo que cerca del tope también varía; `topeMs` NUNCA se supera. `topeMs: 0` desactiva el
 *   indicador y la espera.
 */
export interface OpcionesEscrituraBot {
  baseMs?: number;
  msPorCaracter?: number;
  variacion?: number;
  topeMs?: number;
  mediaMs?: number;
}

/**
 * Ajustes del modo bot (`crearCliente({ modo: "bot", bot })`). Todo es opcional.
 *
 * - `verificarExistencia` (default `true`): consulta `exists` antes de enviar, con caché en
 *   memoria por número (por cliente: crear un cliente por request anula la caché). Si el número no
 *   tiene WhatsApp el envío falla sin salir.
 * - `siVerificacionFalla` (default `"no_enviar"`): qué hacer si la consulta de un número no
 *   cacheado falla (429, 503, red). `"no_enviar"` devuelve un error reintentable con
 *   `codigoApi: "verificacion_no_disponible"` sin enviar; `"enviar"` avisa por `alAdvertir` y envía.
 *   Un cliente de OTP, donde entregar el código pesa más que la cautela, debería usar `"enviar"`.
 * - `ttlExisteMs` (default 7 días): cuánto se confía en un "sí existe". `0` = no cachear.
 * - `ttlInexistenteMs` (default 15 min): cuánto se confía en un "no existe". Es corto porque un
 *   número puede registrarse después; `0` = no cachear los negativos.
 * - `escritura`: ver `OpcionesEscrituraBot`.
 * - `alAdvertir`: se invoca cuando un paso best-effort falla (la verificación, el marcado de leído
 *   o el indicador de escritura) y el envío continúa. Si lanza, se ignora.
 * - `aleatorio`: fuente de aleatoriedad `() => [0, 1)` (default `Math.random`); inyéctala para
 *   tests deterministas.
 */
export interface OpcionesModoBot {
  verificarExistencia?: boolean;
  siVerificacionFalla?: PoliticaFalloVerificacion;
  ttlExisteMs?: number;
  ttlInexistenteMs?: number;
  escritura?: OpcionesEscrituraBot;
  alAdvertir?: (advertencia: AdvertenciaBot) => void;
  aleatorio?: () => number;
}

export interface ConfigModoBot {
  verificarExistencia: boolean;
  siVerificacionFalla: PoliticaFalloVerificacion;
  ttlExisteMs: number;
  ttlInexistenteMs: number;
  escritura: Required<OpcionesEscrituraBot>;
  alAdvertir: ((advertencia: AdvertenciaBot) => void) | undefined;
  aleatorio: () => number;
}

/** `typing` de la API acepta hasta 25 s: un tope mayor dejaría el indicador apagado a mitad de espera. */
const TOPE_MAXIMO_ESCRITURA_MS = 25_000;

const ESCRITURA_POR_DEFECTO: Required<OpcionesEscrituraBot> = {
  baseMs: 600,
  msPorCaracter: 40,
  variacion: 0.25,
  topeMs: 6_000,
  mediaMs: 1_200,
};

const TTL_EXISTE_POR_DEFECTO_MS = 7 * 24 * 60 * 60 * 1000;
const TTL_INEXISTENTE_POR_DEFECTO_MS = 15 * 60 * 1000;

const numeroEnRango = (nombre: string, valor: number, maximo: number): number => {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0 || valor > maximo) {
    throw new ErrorConfiguracion(`${nombre} debe ser un número entre 0 y ${String(maximo)}`);
  }
  return valor;
};

const funcionOpcional = <T extends (...args: never[]) => unknown>(
  nombre: string,
  valor: T | undefined,
) => {
  if (valor !== undefined && typeof valor !== "function") {
    throw new ErrorConfiguracion(`${nombre} debe ser una función`);
  }
  return valor;
};

/**
 * Aplica los defaults y valida las opciones del modo bot.
 *
 * @throws {ErrorConfiguracion} Si algún valor es inválido.
 */
export const resolverOpcionesBot = (opciones: OpcionesModoBot = {}): ConfigModoBot => {
  if (opciones === null || typeof opciones !== "object") {
    throw new ErrorConfiguracion("bot debe ser un objeto");
  }
  if (
    opciones.escritura !== undefined &&
    (opciones.escritura === null || typeof opciones.escritura !== "object")
  ) {
    throw new ErrorConfiguracion("bot.escritura debe ser un objeto");
  }
  const escritura = { ...ESCRITURA_POR_DEFECTO, ...opciones.escritura };
  const verificarExistencia = opciones.verificarExistencia ?? true;
  if (typeof verificarExistencia !== "boolean") {
    throw new ErrorConfiguracion("bot.verificarExistencia debe ser booleano");
  }
  const siVerificacionFalla = opciones.siVerificacionFalla ?? "no_enviar";
  if (siVerificacionFalla !== "no_enviar" && siVerificacionFalla !== "enviar") {
    throw new ErrorConfiguracion('bot.siVerificacionFalla debe ser "no_enviar" o "enviar"');
  }
  const maximoTtl = Number.MAX_SAFE_INTEGER;
  return {
    verificarExistencia,
    siVerificacionFalla,
    ttlExisteMs: numeroEnRango(
      "bot.ttlExisteMs",
      opciones.ttlExisteMs ?? TTL_EXISTE_POR_DEFECTO_MS,
      maximoTtl,
    ),
    ttlInexistenteMs: numeroEnRango(
      "bot.ttlInexistenteMs",
      opciones.ttlInexistenteMs ?? TTL_INEXISTENTE_POR_DEFECTO_MS,
      maximoTtl,
    ),
    escritura: {
      baseMs: numeroEnRango("bot.escritura.baseMs", escritura.baseMs, TOPE_MAXIMO_ESCRITURA_MS),
      msPorCaracter: numeroEnRango(
        "bot.escritura.msPorCaracter",
        escritura.msPorCaracter,
        TOPE_MAXIMO_ESCRITURA_MS,
      ),
      variacion: numeroEnRango("bot.escritura.variacion", escritura.variacion, 1),
      topeMs: numeroEnRango("bot.escritura.topeMs", escritura.topeMs, TOPE_MAXIMO_ESCRITURA_MS),
      mediaMs: numeroEnRango("bot.escritura.mediaMs", escritura.mediaMs, TOPE_MAXIMO_ESCRITURA_MS),
    },
    alAdvertir: funcionOpcional("bot.alAdvertir", opciones.alAdvertir),
    aleatorio: funcionOpcional("bot.aleatorio", opciones.aleatorio) ?? Math.random,
  };
};

/**
 * Duración (ms) del indicador "escribiendo" para un envío. `largoTexto` es `undefined` cuando no
 * hay texto (media sin caption, ubicación): entonces vale `mediaMs`. La variación se aplica sobre
 * el nominal ya recortado a `topeMs`, y el resultado nunca lo supera.
 *
 * `aleatorio` se acota a [0, 1] (un valor no finito cuenta como 0.5): no se puede validar al
 * construir el cliente y el SDK no lanza al enviar, así que una fuente defectuosa no debe producir
 * duraciones negativas ni desbordadas.
 */
export const calcularDuracionEscritura = ({
  largoTexto,
  escritura,
  aleatorio,
}: {
  largoTexto: number | undefined;
  escritura: Required<OpcionesEscrituraBot>;
  aleatorio: () => number;
}): number => {
  const nominal =
    largoTexto === undefined
      ? escritura.mediaMs
      : escritura.baseMs + escritura.msPorCaracter * largoTexto;
  const azar = aleatorio();
  const azarAcotado = Number.isFinite(azar) ? Math.min(1, Math.max(0, azar)) : 0.5;
  const factor = 1 + escritura.variacion * (2 * azarAcotado - 1);
  return Math.round(Math.min(escritura.topeMs, Math.min(escritura.topeMs, nominal) * factor));
};

/**
 * Valida `modo` y `bot` de `crearCliente` / `crearClienteInterno` y devuelve la configuración
 * resuelta, o `undefined` en modo humano.
 *
 * @throws {ErrorConfiguracion} `modo` desconocido, `bot` con modo humano o `bot` inválido.
 */
export const resolverModoBot = (
  modo: "humano" | "bot" | undefined,
  bot: OpcionesModoBot | undefined,
): ConfigModoBot | undefined => {
  const modoEfectivo = modo ?? "humano";
  if (modoEfectivo !== "humano" && modoEfectivo !== "bot") {
    throw new ErrorConfiguracion('modo debe ser "humano" o "bot"');
  }
  if (modoEfectivo === "humano" && bot !== undefined) {
    throw new ErrorConfiguracion('bot solo es válido con modo "bot"');
  }
  return modoEfectivo === "bot" ? resolverOpcionesBot(bot) : undefined;
};
