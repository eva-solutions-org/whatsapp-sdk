import { ErrorConfiguracion } from "../../../core/errors/index.js";
import {
  TIPOS_EVENTO_NOTIFICACION,
  clasificarEvento,
  eventoNotificacionSchema,
} from "../../notificaciones/index.js";
import { CODIGOS_CIERRE_SIN_RECONEXION } from "../domain/index.js";
import type {
  ClienteWs,
  ConstructorWebSocket,
  ErrorWs,
  EscuchaWs,
  MapaEventosWs,
  NombreEventoWs,
  OpcionesConectarWs,
  WebSocketLike,
} from "../domain/index.js";
import { construirConexionWs } from "../infrastructure/index.js";
import { RECONEXION_POR_DEFECTO, calcularEspera } from "./calcular-espera.js";

const MAX_LONGITUD_MENSAJE_POR_DEFECTO = 1_048_576;
const CODIGO_CIERRE_NORMAL = 1000;
/** Cierre anormal (sin frame de cierre), igual al que reporta un runtime ante un upgrade fallido. */
const CODIGO_CIERRE_ANORMAL = 1006;

type Escuchas = Map<NombreEventoWs, Set<(payload: never) => void>>;

/**
 * Abre la conexión WebSocket de eventos en tiempo real y la mantiene.
 *
 * Lanza `ErrorConfiguracion` (síncrono) si `baseUrl`/`apiKey`/`reconexion` son inválidos o no
 * hay WebSocket disponible. Todo lo demás (red, mensajes inválidos) se reporta por el evento
 * `error`; las excepciones de tus escuchas se ignoran para no romper la conexión.
 */
export const conectarWs = (opciones: OpcionesConectarWs): ClienteWs => {
  const { url, protocolos } = construirConexionWs(opciones.baseUrl, opciones.apiKey);
  const Impl: ConstructorWebSocket | undefined =
    opciones.webSocketImpl ?? (globalThis as { WebSocket?: ConstructorWebSocket }).WebSocket;
  if (Impl === undefined) {
    throw new ErrorConfiguracion(
      "No hay WebSocket global (runtime sin WebSocket): pasa webSocketImpl (p. ej. la clase de 'ws')",
    );
  }

  const reconexion =
    opciones.reconexion === false ? null : { ...RECONEXION_POR_DEFECTO, ...opciones.reconexion };
  if (reconexion !== null) {
    for (const [clave, valor] of Object.entries(reconexion)) {
      if (typeof valor !== "number" || !Number.isFinite(valor) || valor < 0) {
        throw new ErrorConfiguracion(`reconexion.${clave} debe ser un número finito >= 0`);
      }
    }
    if (reconexion.jitter > 1) {
      throw new ErrorConfiguracion("reconexion.jitter debe estar entre 0 y 1");
    }
  }
  const maxLongitud = opciones.maxLongitudMensaje ?? MAX_LONGITUD_MENSAJE_POR_DEFECTO;
  const aleatorio = opciones.aleatorio ?? Math.random;

  const escuchas: Escuchas = new Map();
  let socket: WebSocketLike | null = null;
  let abierto = false;
  let detenido = false;
  let conexiones = 0;
  let fallosConsecutivos = 0;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let temporizadorEstable: ReturnType<typeof setTimeout> | null = null;

  const emitir = <K extends NombreEventoWs>(nombre: K, payload: MapaEventosWs[K]): void => {
    const conjunto = escuchas.get(nombre);
    for (const escucha of conjunto ? [...conjunto] : []) {
      try {
        (escucha as EscuchaWs<K>)(payload);
      } catch {
        // Una escucha defectuosa no debe tumbar la conexión ni a las demás.
      }
    }
  };

  const cancelarEstabilidad = (): void => {
    if (temporizadorEstable !== null) {
      clearTimeout(temporizadorEstable);
      temporizadorEstable = null;
    }
  };

  const marcarEstable = (): void => {
    cancelarEstabilidad();
    fallosConsecutivos = 0;
  };

  const reportar = (error: ErrorWs): void => emitir("error", error);

  const procesarMensaje = (datos: unknown): void => {
    if (typeof datos !== "string") {
      reportar({ motivo: "mensaje_invalido", mensaje: "Mensaje no es texto" });
      return;
    }
    if (datos.length > maxLongitud) {
      reportar({
        motivo: "mensaje_demasiado_grande",
        mensaje: `Mensaje de ${datos.length} caracteres supera el tope de ${maxLongitud}`,
      });
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(datos);
    } catch {
      reportar({ motivo: "mensaje_invalido", mensaje: "Mensaje no es JSON válido" });
      return;
    }
    // Heartbeat del server: responder pong a tiempo o cierra la conexión.
    if (typeof json === "object" && json !== null && (json as { type?: unknown }).type === "ping") {
      marcarEstable();
      try {
        socket?.send(JSON.stringify({ type: "pong" }));
      } catch {
        // El cierre llegará por el evento close.
      }
      return;
    }
    const clasificado = clasificarEvento(json, eventoNotificacionSchema, TIPOS_EVENTO_NOTIFICACION);
    if (!clasificado.ok) {
      reportar({
        motivo: "mensaje_invalido",
        mensaje: clasificado.error,
        detalles: clasificado.detalles,
      });
      return;
    }
    const evento = clasificado.evento;
    if ("conocido" in evento && evento.conocido === false) {
      emitir("desconocido", evento);
    } else {
      emitir(evento.type as keyof MapaEventosWs & string, evento as never);
    }
  };

  const programarReconexion = (codigo: number, razon: string): boolean => {
    const sinReconexion = CODIGOS_CIERRE_SIN_RECONEXION.includes(codigo);
    if (detenido || reconexion === null || sinReconexion) return false;
    if (fallosConsecutivos > reconexion.maxIntentos) {
      reportar({
        motivo: "reintentos_agotados",
        mensaje: `Sin conexión tras ${reconexion.maxIntentos} reintentos (último cierre ${codigo} ${razon})`,
      });
      return false;
    }
    const espera = calcularEspera(Math.max(1, fallosConsecutivos), reconexion, aleatorio);
    temporizador = setTimeout(() => {
      temporizador = null;
      abrir();
    }, espera);
    return true;
  };

  const alCerrar = (actual: WebSocketLike, codigo: number, razon: string): void => {
    if (actual !== socket) return;
    socket = null;
    abierto = false;
    cancelarEstabilidad();
    if (!detenido) fallosConsecutivos += 1;
    const reconectara = programarReconexion(codigo, razon);
    if (!reconectara) detenido = true;
    emitir("cerrado", { codigo, razon, reconectara });
  };

  const abrir = (): void => {
    let actual: WebSocketLike;
    try {
      actual = new Impl(url, [...protocolos]);
    } catch (e) {
      reportar({
        motivo: "conexion",
        mensaje: e instanceof Error ? e.message : "No se pudo crear el WebSocket",
      });
      fallosConsecutivos += 1;
      if (!programarReconexion(0, "constructor")) detenido = true;
      return;
    }
    socket = actual;
    actual.addEventListener("open", () => {
      if (actual !== socket) return;
      abierto = true;
      // La API puede cerrar (4429/4503) dentro de onOpen: solo una conexión que se mantiene
      // reinicia el backoff.
      if (reconexion !== null) {
        cancelarEstabilidad();
        temporizadorEstable = setTimeout(marcarEstable, reconexion.estabilidadMs);
      }
      conexiones += 1;
      emitir("abierto", { conexion: conexiones });
    });
    actual.addEventListener("message", (evento) => {
      if (actual === socket) procesarMensaje(evento.data);
    });
    actual.addEventListener("error", () => {
      if (actual !== socket) return;
      // Tras `desconectar()` en CONNECTING el navegador emite `error`: no es un fallo real.
      if (!detenido) reportar({ motivo: "conexion", mensaje: "Error de conexión WebSocket" });
      // Un upgrade rechazado (p. ej. 401 por API key inválida) en el WebSocket de Node
      // (undici) emite `error` sin `close`: sin esto el cliente quedaría mudo. Se trata como
      // un cierre anormal (1006); un `close` real posterior se ignora (`actual !== socket`).
      if (!abierto) {
        // Primero se desliga (`socket = null`): en undici `close()` puede volver a emitir
        // `error` en el acto y, sin esto, entraría en recursión.
        alCerrar(actual, CODIGO_CIERRE_ANORMAL, "");
        try {
          actual.close();
        } catch {
          // El socket ya está fallido: no hay nada que cerrar.
        }
      }
    });
    actual.addEventListener("close", (evento) => alCerrar(actual, evento.code, evento.reason));
  };

  abrir();

  return {
    on(nombre, escucha) {
      const conjunto = escuchas.get(nombre) ?? new Set();
      escuchas.set(nombre, conjunto);
      conjunto.add(escucha as (payload: never) => void);
      return () => {
        conjunto.delete(escucha as (payload: never) => void);
      };
    },
    off(nombre, escucha) {
      escuchas.get(nombre)?.delete(escucha as (payload: never) => void);
    },
    desconectar() {
      if (detenido && socket === null) return;
      detenido = true;
      abierto = false;
      cancelarEstabilidad();
      if (temporizador !== null) {
        clearTimeout(temporizador);
        temporizador = null;
      }
      socket?.close(CODIGO_CIERRE_NORMAL, "desconectar");
    },
    get conectado() {
      return abierto;
    },
  };
};
