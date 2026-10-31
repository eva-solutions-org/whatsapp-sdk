import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorConfiguracion, conectarWs } from "../../../src/ws.js";
import type { ConstructorWebSocket, ErrorWs, InfoCierreWs } from "../../../src/ws.js";
import {
  API_KEY_TEST,
  EVENTO_CONEXION_FIXTURE,
  EVENTO_MENSAJE_TEXTO_FIXTURE,
} from "../../helpers/fixtures.js";

class WebSocketFalso {
  static instancias: WebSocketFalso[] = [];
  readonly enviados: string[] = [];
  cerradoCon: { code: number | undefined; reason: string | undefined } | null = null;
  private readonly escuchas: Record<string, ((e: never) => void)[]> = {};

  constructor(
    readonly url: string,
    readonly protocolos?: string | string[],
  ) {
    WebSocketFalso.instancias.push(this);
  }

  addEventListener(tipo: string, escucha: (e: never) => void): void {
    (this.escuchas[tipo] ??= []).push(escucha);
  }
  send(data: string): void {
    this.enviados.push(data);
  }
  close(code?: number, reason?: string): void {
    this.cerradoCon = { code, reason };
  }

  private disparar(tipo: string, evento?: unknown): void {
    for (const e of this.escuchas[tipo] ?? []) e(evento as never);
  }
  abrir(): void {
    this.disparar("open");
  }
  mensaje(data: unknown): void {
    this.disparar("message", { data });
  }
  cerrar(code: number, reason = ""): void {
    this.disparar("close", { code, reason });
  }
  fallar(): void {
    this.disparar("error", {});
  }
}

const Impl = WebSocketFalso as unknown as ConstructorWebSocket;
const BASE = "https://api.example.com";
const ultimo = (): WebSocketFalso => WebSocketFalso.instancias.at(-1) as WebSocketFalso;

const conectar = (extra: Partial<Parameters<typeof conectarWs>[0]> = {}) =>
  conectarWs({
    baseUrl: BASE,
    apiKey: API_KEY_TEST,
    webSocketImpl: Impl,
    aleatorio: () => 0,
    ...extra,
  });

beforeEach(() => {
  WebSocketFalso.instancias = [];
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("conectarWs - conexión y auth", () => {
  it("usa wss://host/v1/ws/events y la API key en el subprotocolo 'apikey, <key>'", () => {
    conectar();

    expect(ultimo().url).toBe("wss://api.example.com/v1/ws/events");
    expect(ultimo().protocolos).toEqual(["apikey", API_KEY_TEST]);
  });

  it("rechaza opciones de reconexión no finitas, negativas o jitter > 1 sin abrir socket", () => {
    expect(() => conectar({ reconexion: { estabilidadMs: Number.NaN } })).toThrow(
      /reconexion\.estabilidadMs/,
    );
    expect(() => conectar({ reconexion: { maxIntentos: -1 } })).toThrow(ErrorConfiguracion);
    expect(() => conectar({ reconexion: { baseMs: Infinity } })).toThrow(ErrorConfiguracion);
    expect(() => conectar({ reconexion: { jitter: 1.5 } })).toThrow(/jitter/);
    expect(WebSocketFalso.instancias).toHaveLength(0);
    expect(() => conectar({ reconexion: { estabilidadMs: 0, jitter: 1 } })).not.toThrow();
  });

  it("convierte http loopback a ws", () => {
    conectar({ baseUrl: "http://localhost:3000" });

    expect(ultimo().url).toBe("ws://localhost:3000/v1/ws/events");
  });

  it("rechaza baseUrl inválida, apiKey vacía o con caracteres no válidos (sin repetir la key)", () => {
    expect(() => conectar({ baseUrl: "http://evil.example.com" })).toThrow(ErrorConfiguracion);
    expect(() => conectar({ apiKey: "" })).toThrow(ErrorConfiguracion);
    expect(() => conectar({ apiKey: "a, b" })).toThrow(/apiKey/);
    expect(() => conectar({ apiKey: "a, b" })).not.toThrow(/a, b/);
  });

  it("falla con ErrorConfiguracion si no hay WebSocket global ni implementación", () => {
    vi.stubGlobal("WebSocket", undefined);
    try {
      expect(() => conectarWs({ baseUrl: BASE, apiKey: API_KEY_TEST })).toThrow(ErrorConfiguracion);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("emite 'abierto' y refleja 'conectado'", () => {
    const cliente = conectar();
    const abierto = vi.fn();
    cliente.on("abierto", abierto);
    expect(cliente.conectado).toBe(false);

    ultimo().abrir();

    expect(abierto).toHaveBeenCalledWith({ conexion: 1 });
    expect(cliente.conectado).toBe(true);
  });
});

describe("conectarWs - eventos", () => {
  it("rutea eventos por type con el payload tipado y no a otros listeners", () => {
    const cliente = conectar();
    const alMensaje = vi.fn();
    const alConexion = vi.fn();
    cliente.on("message", alMensaje);
    cliente.on("connection", alConexion);
    ultimo().abrir();

    ultimo().mensaje(JSON.stringify(EVENTO_MENSAJE_TEXTO_FIXTURE));

    expect(alMensaje).toHaveBeenCalledTimes(1);
    expect(alMensaje).toHaveBeenCalledWith(EVENTO_MENSAJE_TEXTO_FIXTURE);
    expect(alConexion).not.toHaveBeenCalled();
  });

  it("un message con messageType nuevo llega por 'desconocido' y no es error (forward-compat)", () => {
    const cliente = conectar();
    const alMensaje = vi.fn();
    const alDesconocido = vi.fn();
    const error = vi.fn();
    cliente.on("message", alMensaje);
    cliente.on("desconocido", alDesconocido);
    cliente.on("error", error);
    const evento = {
      ...EVENTO_MENSAJE_TEXTO_FIXTURE,
      data: { ...EVENTO_MENSAJE_TEXTO_FIXTURE.data, messageType: "poll", content: { q: "?" } },
    };

    ultimo().mensaje(JSON.stringify(evento));

    expect(alDesconocido).toHaveBeenCalledWith({ ...evento, conocido: false });
    expect(alMensaje).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("un connection con status nuevo llega por 'connection'", () => {
    const cliente = conectar();
    const alConexion = vi.fn();
    cliente.on("connection", alConexion);
    const evento = { ...EVENTO_CONEXION_FIXTURE, data: { status: "connecting", message: "x" } };

    ultimo().mensaje(JSON.stringify(evento));

    expect(alConexion).toHaveBeenCalledWith(evento);
  });

  it("billing_alert llega por el WebSocket", () => {
    const cliente = conectar();
    const alerta = vi.fn();
    cliente.on("billing_alert", alerta);
    const evento = {
      type: "billing_alert",
      phone: "1",
      timestamp: 1,
      data: { subtipo: "saldo_bajo", mensaje: "poco saldo" },
    };

    ultimo().mensaje(JSON.stringify(evento));

    expect(alerta).toHaveBeenCalledWith(evento);
  });

  it("off y el retorno de on cancelan la suscripción", () => {
    const cliente = conectar();
    const a = vi.fn();
    const b = vi.fn();
    const cancelarA = cliente.on("connection", a);
    cliente.on("connection", b);
    cliente.off("connection", b);
    cancelarA();

    ultimo().mensaje(JSON.stringify(EVENTO_CONEXION_FIXTURE));

    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it("un type desconocido va a 'desconocido' con conocido:false y no es error", () => {
    const cliente = conectar();
    const desconocido = vi.fn();
    const error = vi.fn();
    cliente.on("desconocido", desconocido);
    cliente.on("error", error);
    const crudo = { type: "evento_futuro", phone: "1", data: { x: 1 }, timestamp: 1 };

    ultimo().mensaje(JSON.stringify(crudo));

    expect(desconocido).toHaveBeenCalledWith({ ...crudo, conocido: false });
    expect(error).not.toHaveBeenCalled();
  });

  it("responde pong al ping del server y no lo entrega como evento", () => {
    const cliente = conectar();
    const desconocido = vi.fn();
    const error = vi.fn();
    cliente.on("desconocido", desconocido);
    cliente.on("error", error);

    ultimo().mensaje(JSON.stringify({ type: "ping" }));

    expect(ultimo().enviados).toEqual([JSON.stringify({ type: "pong" })]);
    expect(desconocido).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it.each([
    ["no es JSON", "esto no es json"],
    ["no es texto", new ArrayBuffer(4)],
    ["no tiene type", JSON.stringify({ phone: "1" })],
    [
      "es un evento conocido con forma inválida",
      JSON.stringify({ ...EVENTO_CONEXION_FIXTURE, data: {} }),
    ],
  ])("descarta un mensaje que %s, reporta error y la conexión sigue", (_caso, datos) => {
    const cliente = conectar();
    const errores: ErrorWs[] = [];
    const alConexion = vi.fn();
    cliente.on("error", (e) => errores.push(e));
    cliente.on("connection", alConexion);
    ultimo().abrir();

    ultimo().mensaje(datos);
    ultimo().mensaje(JSON.stringify(EVENTO_CONEXION_FIXTURE));

    expect(errores).toHaveLength(1);
    expect(errores[0]?.motivo).toBe("mensaje_invalido");
    expect(alConexion).toHaveBeenCalledTimes(1);
    expect(cliente.conectado).toBe(true);
  });

  it("descarta mensajes por encima de maxLongitudMensaje", () => {
    const cliente = conectar({ maxLongitudMensaje: 50 });
    const error = vi.fn();
    const alConexion = vi.fn();
    cliente.on("error", error);
    cliente.on("connection", alConexion);

    ultimo().mensaje(JSON.stringify(EVENTO_CONEXION_FIXTURE));

    expect(alConexion).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ motivo: "mensaje_demasiado_grande" }),
    );
  });

  it("una escucha que lanza no rompe a las demás ni la conexión", () => {
    const cliente = conectar();
    const segunda = vi.fn();
    cliente.on("connection", () => {
      throw new Error("boom");
    });
    cliente.on("connection", segunda);

    ultimo().mensaje(JSON.stringify(EVENTO_CONEXION_FIXTURE));

    expect(segunda).toHaveBeenCalledTimes(1);
  });

  it("emite 'error' ante un error de conexión del socket", () => {
    const cliente = conectar();
    const error = vi.fn();
    cliente.on("error", error);

    ultimo().fallar();

    expect(error).toHaveBeenCalledWith(expect.objectContaining({ motivo: "conexion" }));
  });
});

describe("conectarWs - reconexión", () => {
  it("reconecta con backoff exponencial tras cierres sin abrir", () => {
    conectar({ reconexion: { baseMs: 1000, maxMs: 30_000, factor: 2, jitter: 0 } });

    ultimo().cerrar(1006);
    vi.advanceTimersByTime(999);
    expect(WebSocketFalso.instancias).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(WebSocketFalso.instancias).toHaveLength(2);

    ultimo().cerrar(1006);
    vi.advanceTimersByTime(1999);
    expect(WebSocketFalso.instancias).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(WebSocketFalso.instancias).toHaveLength(3);
  });

  it("respeta maxMs y aplica el jitter", () => {
    conectar({
      reconexion: { baseMs: 1000, maxMs: 1500, factor: 2, jitter: 0.5 },
      aleatorio: () => 1,
    });

    ultimo().cerrar(1006);
    vi.advanceTimersByTime(500);
    expect(WebSocketFalso.instancias).toHaveLength(2);

    ultimo().cerrar(1006); // 2000 -> tope 1500 -> jitter 0.5 -> 750
    vi.advanceTimersByTime(749);
    expect(WebSocketFalso.instancias).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(WebSocketFalso.instancias).toHaveLength(3);
  });

  it("reinicia el backoff tras recibir el primer ping (conexión estable) y avisa reconectara:true", () => {
    const cliente = conectar({ reconexion: { baseMs: 1000, jitter: 0 } });
    const cierres: InfoCierreWs[] = [];
    cliente.on("cerrado", (c) => cierres.push(c));
    ultimo().cerrar(1006);
    vi.advanceTimersByTime(1000);
    ultimo().cerrar(1006);
    vi.advanceTimersByTime(2000);
    ultimo().abrir();
    ultimo().mensaje(JSON.stringify({ type: "ping" }));

    ultimo().cerrar(1000, "Pong timeout");
    vi.advanceTimersByTime(1000);

    expect(WebSocketFalso.instancias).toHaveLength(4);
    expect(cierres.at(-1)).toEqual({ codigo: 1000, razon: "Pong timeout", reconectara: true });
  });

  it("reinicia el backoff si la conexión se mantuvo abierta estabilidadMs", () => {
    conectar({ reconexion: { baseMs: 1000, jitter: 0, estabilidadMs: 5000 } });
    ultimo().cerrar(1006);
    vi.advanceTimersByTime(1000);
    ultimo().cerrar(1006);
    vi.advanceTimersByTime(2000);
    ultimo().abrir();
    vi.advanceTimersByTime(5000);

    ultimo().cerrar(1000);
    vi.advanceTimersByTime(999);
    expect(WebSocketFalso.instancias).toHaveLength(3);
    vi.advanceTimersByTime(1);

    expect(WebSocketFalso.instancias).toHaveLength(4);
  });

  it("open + cierre inmediato repetido (4429/4503 en onOpen) hace crecer el backoff", () => {
    conectar({ reconexion: { baseMs: 1000, jitter: 0, estabilidadMs: 5000 } });

    ultimo().abrir();
    ultimo().cerrar(4429);
    vi.advanceTimersByTime(999);
    expect(WebSocketFalso.instancias).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(WebSocketFalso.instancias).toHaveLength(2);

    ultimo().abrir();
    ultimo().cerrar(4503);
    vi.advanceTimersByTime(1999);
    expect(WebSocketFalso.instancias).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(WebSocketFalso.instancias).toHaveLength(3);
  });

  it("open + cierre inmediato repetido respeta maxIntentos", () => {
    const cliente = conectar({
      reconexion: { baseMs: 10, jitter: 0, maxIntentos: 2, estabilidadMs: 5000 },
    });
    const error = vi.fn();
    cliente.on("error", error);

    for (let i = 0; i < 6; i++) {
      ultimo().abrir();
      ultimo().cerrar(4429);
      vi.advanceTimersByTime(1000);
    }

    expect(WebSocketFalso.instancias).toHaveLength(3);
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ motivo: "reintentos_agotados" }));
  });

  it.each([1008, 4401, 4403])("no reconecta tras el cierre de auth/política %i", (codigo) => {
    const cliente = conectar();
    const cerrado = vi.fn();
    cliente.on("cerrado", cerrado);

    ultimo().cerrar(codigo, "no autorizado");
    vi.advanceTimersByTime(600_000);

    expect(WebSocketFalso.instancias).toHaveLength(1);
    expect(cerrado).toHaveBeenCalledWith({ codigo, razon: "no autorizado", reconectara: false });
  });

  it("sí reconecta tras 4429 (límite de conexiones, transitorio)", () => {
    conectar({ reconexion: { jitter: 0 } });

    ultimo().cerrar(4429);
    vi.advanceTimersByTime(1000);

    expect(WebSocketFalso.instancias).toHaveLength(2);
  });

  it("reconexion:false no reconecta", () => {
    const cliente = conectar({ reconexion: false });
    const cerrado = vi.fn();
    cliente.on("cerrado", cerrado);

    ultimo().cerrar(1006);
    vi.advanceTimersByTime(600_000);

    expect(WebSocketFalso.instancias).toHaveLength(1);
    expect(cerrado).toHaveBeenCalledWith(expect.objectContaining({ reconectara: false }));
  });

  it("se rinde tras maxIntentos fallos consecutivos y lo reporta", () => {
    const cliente = conectar({ reconexion: { baseMs: 10, jitter: 0, maxIntentos: 2 } });
    const error = vi.fn();
    cliente.on("error", error);

    for (let i = 0; i < 5; i++) {
      ultimo().cerrar(1006);
      vi.advanceTimersByTime(1000);
    }

    expect(WebSocketFalso.instancias).toHaveLength(3); // inicial + 2 reintentos
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ motivo: "reintentos_agotados" }));
  });

  it("ignora eventos de un socket anterior ya reemplazado", () => {
    const cliente = conectar({ reconexion: { baseMs: 10, jitter: 0 } });
    const alConexion = vi.fn();
    cliente.on("connection", alConexion);
    const viejo = ultimo();
    viejo.cerrar(1006);
    vi.advanceTimersByTime(10);

    viejo.mensaje(JSON.stringify(EVENTO_CONEXION_FIXTURE));

    expect(alConexion).not.toHaveBeenCalled();
  });
});

describe("conectarWs - desconectar", () => {
  it("cierra el socket con 1000 y no reconecta", () => {
    const cliente = conectar({ reconexion: { baseMs: 10, jitter: 0 } });
    const cerrado = vi.fn();
    cliente.on("cerrado", cerrado);
    ultimo().abrir();

    cliente.desconectar();
    expect(ultimo().cerradoCon?.code).toBe(1000);
    ultimo().cerrar(1000);
    vi.advanceTimersByTime(600_000);

    expect(WebSocketFalso.instancias).toHaveLength(1);
    expect(cerrado).toHaveBeenCalledWith(expect.objectContaining({ reconectara: false }));
    expect(cliente.conectado).toBe(false);
  });

  it("cancela una reconexión pendiente", () => {
    const cliente = conectar({ reconexion: { baseMs: 1000, jitter: 0 } });
    ultimo().cerrar(1006);

    cliente.desconectar();
    vi.advanceTimersByTime(600_000);

    expect(WebSocketFalso.instancias).toHaveLength(1);
  });
});

describe("conectarWs - runtimes que emiten error sin close (undici ante upgrade 401)", () => {
  it("un error antes de abrir se trata como cierre 1006 y sigue la política de reconexión", () => {
    const cierres: InfoCierreWs[] = [];
    const errores: ErrorWs[] = [];
    const cliente = conectar({ reconexion: { maxIntentos: 1 } });
    cliente.on("cerrado", (c) => cierres.push(c));
    cliente.on("error", (e) => errores.push(e));

    ultimo().fallar();
    expect(cierres).toEqual([{ codigo: 1006, razon: "", reconectara: true }]);

    vi.advanceTimersByTime(60_000);
    expect(WebSocketFalso.instancias).toHaveLength(2);
    ultimo().fallar();

    expect(cierres.at(-1)).toEqual({ codigo: 1006, razon: "", reconectara: false });
    expect(errores.map((e) => e.motivo)).toContain("reintentos_agotados");
  });

  it("no entra en recursión si close() del runtime dispara otro error en el acto (undici)", () => {
    class WebSocketUndici extends WebSocketFalso {
      override close(code?: number, reason?: string): void {
        super.close(code, reason);
        this.fallar();
      }
    }
    const errores: ErrorWs[] = [];
    const cierres: InfoCierreWs[] = [];
    const cliente = conectarWs({
      baseUrl: BASE,
      apiKey: API_KEY_TEST,
      webSocketImpl: WebSocketUndici as unknown as ConstructorWebSocket,
      reconexion: false,
    });
    cliente.on("error", (e) => errores.push(e));
    cliente.on("cerrado", (c) => cierres.push(c));

    ultimo().fallar();

    expect(errores).toHaveLength(1);
    expect(cierres).toEqual([{ codigo: 1006, razon: "", reconectara: false }]);
  });

  it("un close real posterior al error sintético no se procesa dos veces", () => {
    const cierres: InfoCierreWs[] = [];
    const cliente = conectar({ reconexion: false });
    cliente.on("cerrado", (c) => cierres.push(c));
    const socket = ultimo();

    socket.fallar();
    socket.cerrar(1006);

    expect(cierres).toHaveLength(1);
  });

  it("un error con la conexión ya abierta espera el close del runtime", () => {
    const cierres: InfoCierreWs[] = [];
    const cliente = conectar();
    cliente.on("cerrado", (c) => cierres.push(c));
    ultimo().abrir();

    ultimo().fallar();

    expect(cierres).toHaveLength(0);
    expect(cliente.conectado).toBe(true);
  });
});

describe("conectarWs - desconectar", () => {
  it("conectado pasa a false en el mismo tick de desconectar()", () => {
    const cliente = conectar();
    ultimo().abrir();

    cliente.desconectar();

    expect(cliente.conectado).toBe(false);
  });
});

describe("conectarWs - desconectar en CONNECTING", () => {
  it("no reporta error espurio si el runtime emite error tras desconectar()", () => {
    const errores: ErrorWs[] = [];
    const cliente = conectar();
    cliente.on("error", (e) => errores.push(e));

    cliente.desconectar();
    ultimo().fallar();

    expect(errores).toEqual([]);
  });
});
