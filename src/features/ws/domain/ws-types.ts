import type {
  EventoDesconocido,
  EventoNotificacion,
  TipoEventoNotificacion,
} from "../../notificaciones/index.js";

/**
 * Protocolo real del endpoint `GET /v1/ws/events` de la API:
 *  - Auth: header `Sec-WebSocket-Protocol: apikey, <key>` (ws-auth.ts). Sin key válida el
 *    upgrade se rechaza con HTTP 401 (el cliente solo ve un cierre 1006, sin código).
 *  - El server envía cada evento como un JSON de texto con el envelope
 *    `{ type, phone, data, timestamp }`.
 *  - Heartbeat: cada 30 s envía `{"type":"ping"}` y espera `{"type":"pong"}` en 10 s; si no,
 *    cierra con 1000.
 *  - Al conectar, el server drena solo los eventos pendientes del buffer (no hay ack).
 */
export const RUTA_WS_EVENTOS = "/v1/ws/events";
export const SUBPROTOCOLO_APIKEY = "apikey";

/**
 * Cierres del server tras los cuales reconectar es inútil (auth / política):
 * 1008 (policy violation) y 4401/4403 (no autorizado / prohibido).
 * 4429 (demasiadas conexiones del phone) y 4503 (server al límite) sí son transitorios.
 */
export const CODIGOS_CIERRE_SIN_RECONEXION: readonly number[] = [1008, 4401, 4403];

/** Subconjunto mínimo de `WebSocket` que usa el SDK (nativo, `ws`-compatible o falso en tests). */
export interface WebSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(tipo: "open", escucha: () => void): void;
  addEventListener(tipo: "message", escucha: (evento: { data: unknown }) => void): void;
  addEventListener(
    tipo: "close",
    escucha: (evento: { code: number; reason: string }) => void,
  ): void;
  addEventListener(tipo: "error", escucha: (evento: unknown) => void): void;
}

export type ConstructorWebSocket = new (
  url: string,
  protocolos?: string | string[],
) => WebSocketLike;

export interface OpcionesReconexion {
  /** Espera base en ms antes del primer reintento. Por defecto 1000. */
  baseMs?: number;
  /** Tope de la espera en ms. Por defecto 30000. */
  maxMs?: number;
  /** Factor exponencial. Por defecto 2. */
  factor?: number;
  /** Fracción (0..1) de la espera que se descuenta al azar. Por defecto 0.5. */
  jitter?: number;
  /**
   * Intentos consecutivos sin lograr una conexión estable antes de rendirse. Por defecto 10.
   * Protege de un bucle eterno con una key inválida (el 401 del upgrade se ve como un cierre 1006).
   * Cuenta también las aperturas que el server cierra de inmediato (4429/4503). Agotados, emite
   * `error` con motivo `reintentos_agotados` y el cliente queda detenido: escucha ese evento y
   * vuelve a llamar a `conectarWs` si quieres seguir recibiendo eventos.
   */
  maxIntentos?: number;
  /**
   * Ms que la conexión debe seguir abierta (o recibir el primer `ping` del server, lo que
   * ocurra antes) para considerarla estable y reiniciar el backoff. Por defecto 10000. Evita
   * un bucle sin espera cuando el server cierra (4429/4503) justo tras aceptar el upgrade.
   */
  estabilidadMs?: number;
}

export interface OpcionesConectarWs {
  /** Origin de la API (`https://host`; `http` solo loopback). Se convierte a `ws(s)`. */
  baseUrl: string;
  /** API key (x-api-key) del phone. Viaja en `Sec-WebSocket-Protocol`. */
  apiKey: string;
  /** `false` desactiva la reconexión automática. */
  reconexion?: false | OpcionesReconexion;
  /** Tope de longitud (caracteres) de un mensaje entrante; mayores se descartan. Por defecto 1 MiB. */
  maxLongitudMensaje?: number;
  /** Implementación de WebSocket (runtime sin WebSocket global o tests). Por defecto `globalThis.WebSocket`. */
  webSocketImpl?: ConstructorWebSocket;
  /** Fuente de aleatoriedad para el jitter (tests). Por defecto `Math.random`. */
  aleatorio?: () => number;
}

export type MotivoErrorWs =
  | "mensaje_invalido"
  | "mensaje_demasiado_grande"
  | "conexion"
  | "reintentos_agotados";

export interface ErrorWs {
  motivo: MotivoErrorWs;
  mensaje: string;
  detalles?: unknown;
}

export interface InfoCierreWs {
  codigo: number;
  razon: string;
  /** `true` si se programó una reconexión. */
  reconectara: boolean;
}

export interface InfoAperturaWs {
  /** Número de conexión exitosa (1 = la primera). */
  conexion: number;
}

/** Evento -> payload. Los tipos de la API van por su `type`; `desconocido` agrupa el resto. */
export type MapaEventosWs = {
  [K in TipoEventoNotificacion]: Extract<EventoNotificacion, { type: K }>;
} & {
  desconocido: EventoDesconocido;
  abierto: InfoAperturaWs;
  cerrado: InfoCierreWs;
  error: ErrorWs;
};

export type NombreEventoWs = keyof MapaEventosWs;
export type EscuchaWs<K extends NombreEventoWs> = (payload: MapaEventosWs[K]) => void;

export interface ClienteWs {
  /** Suscribe; retorna la función que cancela la suscripción. */
  on<K extends NombreEventoWs>(nombre: K, escucha: EscuchaWs<K>): () => void;
  off<K extends NombreEventoWs>(nombre: K, escucha: EscuchaWs<K>): void;
  /** Cierre definitivo: cancela reintentos pendientes y no vuelve a conectar. */
  desconectar(): void;
  /** `true` mientras el socket está abierto. */
  readonly conectado: boolean;
}
