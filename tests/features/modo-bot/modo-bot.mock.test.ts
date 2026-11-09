import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { crearCliente } from "../../../src/core/cliente/index.js";
import { ErrorConfiguracion } from "../../../src/core/errors/index.js";
import { crearFacadeChats } from "../../../src/features/chats/index.js";
import { crearFacadeMensajes } from "../../../src/features/mensajes/index.js";
import {
  CODIGO_NUMERO_SIN_WHATSAPP,
  CODIGO_VERIFICACION_NO_DISPONIBLE,
  aplicarModoBot,
  resolverOpcionesBot,
} from "../../../src/features/modo-bot/index.js";
import type { OpcionesModoBot } from "../../../src/features/modo-bot/index.js";
import { calcularDuracionEscritura } from "../../../src/features/modo-bot/domain/index.js";
import { API_KEY_TEST } from "../../helpers/fixtures.js";
import { crearHttpDePrueba } from "../../helpers/http-prueba.js";
import { BASE_URL_PRUEBA, respuestaError, respuestaJsonData } from "../../helpers/mock-fetch.js";

const PHONE = "593999999999";
const OTRO_PHONE = "593988888888";

interface Escenario {
  /** Se lee en cada llamada: un test puede mutarlo entre envíos. */
  existe?: boolean | "429" | "503";
  /** Si se pasa, la respuesta de `exists` espera a que se resuelva. */
  retenerExists?: Promise<void>;
  typingFalla?: boolean;
  leerFalla?: boolean;
}

/** Arma facades reales contra un fetch simulado; `eventos` registra llamadas HTTP y esperas en orden. */
const armar = (
  escenario: Escenario = {},
  bot: OpcionesModoBot = {},
  costuras: {
    ahora?: () => number;
    dormir?: (ms: number, signal?: AbortSignal) => Promise<void>;
  } = {},
  signalCliente?: AbortSignal,
) => {
  const eventos: string[] = [];
  const cuerpos: Record<string, unknown> = {};
  const { http, fetchMock } = crearHttpDePrueba(
    async (url, init) => {
      const ruta = new URL(url).pathname.replace(/\d{7,15}/, "{phone}");
      eventos.push(`${init.method ?? "GET"} ${ruta}`);
      if (typeof init.body === "string") cuerpos[ruta] = JSON.parse(init.body);
      if (ruta.endsWith("/exists")) {
        // Como un fetch real: si se aborta mientras la respuesta está retenida, rechaza.
        await Promise.race([
          escenario.retenerExists,
          new Promise<never>((_resolver, rechazar) => {
            init.signal?.addEventListener("abort", () => rechazar(new Error("aborted")), {
              once: true,
            });
          }),
        ]);
        if (escenario.existe === "429") {
          return respuestaError(429, "Demasiadas consultas", { "Retry-After": "1800" });
        }
        if (escenario.existe === "503") {
          return respuestaError(503, "Sesión de WhatsApp no disponible");
        }
        return respuestaJsonData({ exists: escenario.existe ?? true });
      }
      if (ruta.endsWith("/typing") && escenario.typingFalla === true) {
        return respuestaError(503, "Sesión de WhatsApp no disponible");
      }
      if (ruta.endsWith("/read") && escenario.leerFalla === true) {
        return respuestaError(503, "Sesión de WhatsApp no disponible");
      }
      return respuestaJsonData({ message: "ok" });
    },
    { clientSignal: signalCliente },
  );
  const advertencias: { paso: string; codigo: number }[] = [];
  const config = resolverOpcionesBot({
    aleatorio: () => 0.5, // factor de variación neutro
    alAdvertir: (a) => advertencias.push({ paso: a.paso, codigo: a.error.codigo }),
    ...bot,
  });
  const mensajes = aplicarModoBot({
    mensajes: crearFacadeMensajes(http),
    chats: crearFacadeChats(http),
    config,
    signal: signalCliente,
    costuras: {
      dormir: (ms) => {
        eventos.push(`dormir ${String(ms)}`);
        return Promise.resolve();
      },
      ...costuras,
    },
  });
  return { mensajes, eventos, cuerpos, advertencias, fetchMock };
};

describe("modo humano (sin modo bot)", () => {
  it("un envío hace exactamente una llamada: el POST de envío", async () => {
    const eventos: string[] = [];
    const fetchMock = vi.fn((url: string | URL | Request) => {
      eventos.push(new URL(url as string).pathname);
      return Promise.resolve(respuestaJsonData({ message: "ok" }));
    }) as unknown as typeof globalThis.fetch;
    const cliente = crearCliente({
      baseUrl: BASE_URL_PRUEBA,
      apiKey: API_KEY_TEST,
      fetch: fetchMock,
    });

    const r = await cliente.mensajes.enviarTexto(
      { phone: PHONE, message: "hola" },
      { messageIds: ["A1"] },
    );

    expect(r).toEqual({ success: true, data: { message: "ok" } });
    expect(eventos).toEqual(["/v1/send/message"]);
  });

  it("rechaza `bot` sin modo bot y un modo desconocido", () => {
    const base = { baseUrl: BASE_URL_PRUEBA, apiKey: API_KEY_TEST };

    expect(() => crearCliente({ ...base, bot: {} })).toThrow(ErrorConfiguracion);
    expect(() => crearCliente({ ...base, modo: "robot" as unknown as "bot" })).toThrow(
      ErrorConfiguracion,
    );
  });
});

describe("modo bot: orden de llamadas", () => {
  it("verifica, marca leído, escribe, espera y recién entonces envía", async () => {
    const { mensajes, eventos, cuerpos } = armar();

    const r = await mensajes.enviarTexto(
      { phone: PHONE, message: "hola" },
      { messageIds: ["A1", "B2"] },
    );

    expect(r).toEqual({ success: true, data: { message: "ok" } });
    // 600 + 40 * 4 = 760 ms (variación neutra) -> typing con 1 s
    expect(eventos).toEqual([
      "GET /v1/chats/{phone}/exists",
      "POST /v1/chats/{phone}/read",
      "POST /v1/chats/{phone}/typing",
      "dormir 760",
      "POST /v1/send/message",
    ]);
    expect(cuerpos["/v1/chats/{phone}/read"]).toEqual({ messageIds: ["A1", "B2"] });
    expect(cuerpos["/v1/chats/{phone}/typing"]).toEqual({ estado: "escribiendo", segundos: 1 });
    expect(cuerpos["/v1/send/message"]).toEqual({ phone: PHONE, message: "hola" });
  });

  it("sin messageIds no llama a read", async () => {
    const { mensajes, eventos } = armar();

    await mensajes.enviarTexto({ phone: PHONE, message: "hola" });

    expect(eventos.filter((e) => e.includes("/read"))).toEqual([]);
    expect(eventos).toContain("POST /v1/chats/{phone}/typing");
  });

  it("una ubicación (sin texto) espera el tiempo fijo de media", async () => {
    const { mensajes, eventos } = armar();

    await mensajes.enviarUbicacion({ phone: PHONE, latitude: -0.18, longitude: -78.47 });

    expect(eventos).toContain("dormir 1200");
    expect(eventos.at(-1)).toBe("POST /v1/send/location");
  });

  it("un input sin teléfono válido pasa al envío, que responde 422 sin llamadas extra", async () => {
    const { mensajes, fetchMock } = armar();

    const r = await mensajes.enviarTexto({ phone: "+593999999999", message: "hola" });

    expect(r).toMatchObject({ success: false, codigo: 422, origen: "local" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no actúa sobre enviarLote", async () => {
    const { mensajes, eventos } = armar();

    await mensajes.enviarLote({ destinatarios: [PHONE], mensaje: "hola" });

    expect(eventos).toEqual(["POST /v1/send/batch"]);
  });
});

describe("modo bot: caché de existencia", () => {
  it("consulta exists una sola vez por número aunque se envíen varios mensajes", async () => {
    const { mensajes, eventos } = armar();

    await mensajes.enviarTexto({ phone: PHONE, message: "uno" });
    await mensajes.enviarTexto({ phone: PHONE, message: "dos" });
    await mensajes.enviarTexto({ phone: OTRO_PHONE, message: "tres" });

    expect(eventos.filter((e) => e.endsWith("/exists"))).toHaveLength(2);
    expect(eventos.filter((e) => e === "POST /v1/send/message")).toHaveLength(3);
  });

  it("envíos simultáneos al mismo número comparten una sola consulta", async () => {
    const { mensajes, eventos } = armar();

    await Promise.all([
      mensajes.enviarTexto({ phone: PHONE, message: "uno" }),
      mensajes.enviarTexto({ phone: PHONE, message: "dos" }),
    ]);

    expect(eventos.filter((e) => e.endsWith("/exists"))).toHaveLength(1);
  });

  it("vuelve a consultar cuando vence el TTL del positivo", async () => {
    let reloj = 0;
    const { mensajes, eventos } = armar({}, { ttlExisteMs: 1000 }, { ahora: () => reloj });

    await mensajes.enviarTexto({ phone: PHONE, message: "uno" });
    reloj = 999;
    await mensajes.enviarTexto({ phone: PHONE, message: "dos" });
    reloj = 1000;
    await mensajes.enviarTexto({ phone: PHONE, message: "tres" });

    expect(eventos.filter((e) => e.endsWith("/exists"))).toHaveLength(2);
  });

  it("al llegar al tope de entradas desaloja la más antigua y la vuelve a consultar", async () => {
    const { mensajes, eventos } = armar({}, { escritura: { topeMs: 0 } });
    const telefono = (n: number) => String(593_000_000_000 + n);
    const consultas = () => eventos.filter((e) => e.endsWith("/exists")).length;

    for (let n = 0; n < 10_000; n++) {
      await mensajes.enviarTexto({ phone: telefono(n), message: "a" });
    }
    expect(consultas()).toBe(10_000);

    await mensajes.enviarTexto({ phone: telefono(1), message: "b" }); // sigue en caché
    expect(consultas()).toBe(10_000);

    await mensajes.enviarTexto({ phone: telefono(10_000), message: "a" }); // desaloja telefono(0)
    expect(consultas()).toBe(10_001);
    await mensajes.enviarTexto({ phone: telefono(1), message: "c" }); // sigue en caché
    expect(consultas()).toBe(10_001);

    await mensajes.enviarTexto({ phone: telefono(0), message: "d" }); // fue desalojado
    expect(consultas()).toBe(10_002);
  });

  it("verificarExistencia: false no consulta exists", async () => {
    const { mensajes, eventos } = armar({}, { verificarExistencia: false });

    await mensajes.enviarTexto({ phone: PHONE, message: "hola" });

    expect(eventos.filter((e) => e.endsWith("/exists"))).toEqual([]);
    expect(eventos.at(-1)).toBe("POST /v1/send/message");
  });
});

describe("modo bot: número inexistente", () => {
  it("devuelve 404 local tipado y no escribe ni envía", async () => {
    const { mensajes, eventos } = armar({ existe: false });

    const r = await mensajes.enviarTexto({ phone: PHONE, message: "hola" }, { messageIds: ["A1"] });

    expect(r).toMatchObject({
      success: false,
      codigo: 404,
      origen: "local",
      codigoApi: CODIGO_NUMERO_SIN_WHATSAPP,
    });
    expect(eventos).toEqual(["GET /v1/chats/{phone}/exists"]);
  });

  it("cachea el negativo con su TTL corto y reconsulta al vencer", async () => {
    let reloj = 0;
    const { mensajes, eventos } = armar(
      { existe: false },
      { ttlInexistenteMs: 500 },
      { ahora: () => reloj },
    );

    await mensajes.enviarTexto({ phone: PHONE, message: "uno" });
    await mensajes.enviarTexto({ phone: PHONE, message: "dos" });
    expect(eventos.filter((e) => e.endsWith("/exists"))).toHaveLength(1);

    reloj = 500;
    await mensajes.enviarTexto({ phone: PHONE, message: "tres" });
    expect(eventos.filter((e) => e.endsWith("/exists"))).toHaveLength(2);
  });
});

describe("modo bot: fallos best-effort", () => {
  it('con siVerificacionFalla "enviar" un 429 de exists no impide el envío, avisa y no cachea', async () => {
    const { mensajes, eventos, advertencias } = armar(
      { existe: "429" },
      { siVerificacionFalla: "enviar" },
    );

    const r1 = await mensajes.enviarTexto({ phone: PHONE, message: "uno" });
    await mensajes.enviarTexto({ phone: PHONE, message: "dos" });

    expect(r1).toEqual({ success: true, data: { message: "ok" } });
    expect(advertencias).toEqual([
      { paso: "verificar", codigo: 429 },
      { paso: "verificar", codigo: 429 },
    ]);
    expect(eventos.filter((e) => e === "POST /v1/send/message")).toHaveLength(2);
    expect(eventos.filter((e) => e.endsWith("/exists"))).toHaveLength(2);
  });

  it("un fallo de typing avisa, no espera y envía igual", async () => {
    const { mensajes, eventos, advertencias } = armar({ typingFalla: true });

    const r = await mensajes.enviarTexto({ phone: PHONE, message: "hola" });

    expect(r.success).toBe(true);
    expect(advertencias).toEqual([{ paso: "escribir", codigo: 503 }]);
    expect(eventos.some((e) => e.startsWith("dormir"))).toBe(false);
    expect(eventos.at(-1)).toBe("POST /v1/send/message");
  });

  it("un fallo de read avisa y sigue con escribir y enviar", async () => {
    const { mensajes, eventos, advertencias } = armar({ leerFalla: true });

    const r = await mensajes.enviarTexto({ phone: PHONE, message: "hola" }, { messageIds: ["A1"] });

    expect(r.success).toBe(true);
    expect(advertencias).toEqual([{ paso: "leer", codigo: 503 }]);
    expect(eventos).toContain("POST /v1/chats/{phone}/typing");
    expect(eventos.at(-1)).toBe("POST /v1/send/message");
  });

  it("un alAdvertir que lanza no impide el envío", async () => {
    const { mensajes } = armar(
      { typingFalla: true },
      {
        alAdvertir: () => {
          throw new Error("boom");
        },
      },
    );

    const r = await mensajes.enviarTexto({ phone: PHONE, message: "hola" });

    expect(r.success).toBe(true);
  });
});

/** Promesa pendiente más su `liberar`, para retener la respuesta de `exists`. */
const retencion = () => {
  let liberar: () => void = () => {};
  const retenida = new Promise<void>((resolver) => {
    liberar = resolver;
  });
  return { retenida, liberar };
};

describe("modo bot: fallo de la verificación (siVerificacionFalla)", () => {
  it.each([
    ["429", 429],
    ["503", 503],
  ] as const)(
    "por defecto un %s de exists no envía y devuelve un error reintentable que conserva la causa",
    async (existe, codigo) => {
      const { mensajes, eventos, advertencias } = armar({ existe });

      const r = await mensajes.enviarTexto(
        { phone: PHONE, message: "hola" },
        { messageIds: ["A1"] },
      );

      expect(r).toMatchObject({
        success: false,
        codigo,
        origen: "api",
        codigoApi: CODIGO_VERIFICACION_NO_DISPONIBLE,
      });
      expect(CODIGO_VERIFICACION_NO_DISPONIBLE).not.toBe(CODIGO_NUMERO_SIN_WHATSAPP);
      expect(eventos).toEqual(["GET /v1/chats/{phone}/exists"]);
      expect(advertencias).toEqual([]);
    },
  );

  it("el error del 429 conserva retryAfter y no se cachea (el siguiente envío reconsulta)", async () => {
    const escenario: Escenario = { existe: "429" };
    const { mensajes, eventos } = armar(escenario);

    const r1 = await mensajes.enviarTexto({ phone: PHONE, message: "uno" });
    escenario.existe = true;
    const r2 = await mensajes.enviarTexto({ phone: PHONE, message: "dos" });

    expect(r1).toMatchObject({ codigo: 429, retryAfter: 1800 });
    expect(r2.success).toBe(true);
    expect(eventos.filter((e) => e.endsWith("/exists"))).toHaveLength(2);
  });

  it("un número ya cacheado como existente no se ve afectado por un fallo posterior", async () => {
    const escenario: Escenario = { existe: true };
    const { mensajes, eventos, advertencias } = armar(escenario);

    await mensajes.enviarTexto({ phone: PHONE, message: "uno" });
    escenario.existe = "429";
    const r = await mensajes.enviarTexto({ phone: PHONE, message: "dos" });

    expect(r.success).toBe(true);
    expect(advertencias).toEqual([]);
    expect(eventos.filter((e) => e.endsWith("/exists"))).toHaveLength(1);
  });

  it("la consulta compartida que falla aplica la política a ambos llamadores", async () => {
    const { retenida, liberar } = retencion();
    const { mensajes, eventos } = armar({ existe: "503", retenerExists: retenida });

    const ambos = Promise.all([
      mensajes.enviarTexto({ phone: PHONE, message: "uno" }),
      mensajes.enviarTexto({ phone: PHONE, message: "dos" }),
    ]);
    liberar();
    const [r1, r2] = await ambos;

    expect(r1).toMatchObject({ codigoApi: CODIGO_VERIFICACION_NO_DISPONIBLE, codigo: 503 });
    expect(r2).toMatchObject({ codigoApi: CODIGO_VERIFICACION_NO_DISPONIBLE, codigo: 503 });
    expect(eventos).toEqual(["GET /v1/chats/{phone}/exists"]);
  });

  it('con "enviar" la consulta compartida que falla avisa y envía en ambos llamadores', async () => {
    const { retenida, liberar } = retencion();
    const { mensajes, eventos, advertencias } = armar(
      { existe: "503", retenerExists: retenida },
      { siVerificacionFalla: "enviar" },
    );

    const ambos = Promise.all([
      mensajes.enviarTexto({ phone: PHONE, message: "uno" }),
      mensajes.enviarTexto({ phone: PHONE, message: "dos" }),
    ]);
    liberar();
    const [r1, r2] = await ambos;

    expect([r1.success, r2.success]).toEqual([true, true]);
    expect(eventos.filter((e) => e.endsWith("/exists"))).toHaveLength(1);
    expect(eventos.filter((e) => e === "POST /v1/send/message")).toHaveLength(2);
    expect(advertencias).toEqual([
      { paso: "verificar", codigo: 503 },
      { paso: "verificar", codigo: 503 },
    ]);
  });

  it("un exists:false sigue siendo numero_sin_whatsapp, no un fallo de verificación", async () => {
    const { mensajes } = armar({ existe: false });

    const r = await mensajes.enviarTexto({ phone: PHONE, message: "hola" });

    expect(r).toMatchObject({ codigo: 404, codigoApi: CODIGO_NUMERO_SIN_WHATSAPP });
  });

  it("rechaza un valor inválido", () => {
    expect(() =>
      resolverOpcionesBot({ siVerificacionFalla: "reintentar" as unknown as "enviar" }),
    ).toThrow(
      expect.objectContaining({
        name: "ErrorConfiguracion",
        message: expect.stringContaining("siVerificacionFalla"),
      }),
    );
  });
});

describe("modo bot: cancelación", () => {
  /** `dormir` que queda pendiente hasta que su `signal` aborta; guarda esa `signal`. */
  const dormirHastaAbort = () => {
    const visto: { signal?: AbortSignal | undefined } = {};
    const dormir = (_ms: number, signal?: AbortSignal) =>
      new Promise<void>((resolver) => {
        visto.signal = signal;
        signal?.addEventListener("abort", () => resolver(), { once: true });
      });
    return { visto, dormir };
  };

  it("abortar opciones.signal durante la espera devuelve el error de abort y no envía", async () => {
    const { visto, dormir } = dormirHastaAbort();
    const { mensajes, eventos } = armar({}, {}, { dormir });
    const controlador = new AbortController();

    const pendiente = mensajes.enviarTexto(
      { phone: PHONE, message: "hola" },
      { signal: controlador.signal },
    );
    await vi.waitFor(() => expect(visto.signal).toBeDefined());
    controlador.abort();
    const r = await pendiente;

    expect(r).toMatchObject({ success: false, codigo: 503, origen: "transporte" });
    expect(eventos).not.toContain("POST /v1/send/message");
  });

  it("abortar el signal global del cliente durante la espera devuelve el error de abort y no envía", async () => {
    const { visto, dormir } = dormirHastaAbort();
    const global = new AbortController();
    const { mensajes, eventos } = armar({}, {}, { dormir }, global.signal);

    const pendiente = mensajes.enviarTexto({ phone: PHONE, message: "hola" });
    await vi.waitFor(() => expect(visto.signal).toBeDefined());
    expect(visto.signal?.aborted).toBe(false);
    global.abort();
    const r = await pendiente;

    expect(visto.signal?.aborted).toBe(true);
    expect(r).toMatchObject({ success: false, codigo: 503, origen: "transporte" });
    expect(eventos).not.toContain("POST /v1/send/message");
  });

  it("con crearCliente, abortar `signal` corta la espera real de escritura", async () => {
    const global = new AbortController();
    const eventos: string[] = [];
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const ruta = new URL(url as string).pathname;
      eventos.push(ruta.replace(/\d{7,15}/, "{phone}"));
      if (ruta.endsWith("/typing")) setTimeout(() => global.abort(), 0);
      return Promise.resolve(
        respuestaJsonData(ruta.endsWith("/exists") ? { exists: true } : { message: "ok" }),
      );
    }) as unknown as typeof globalThis.fetch;
    const cliente = crearCliente({
      baseUrl: BASE_URL_PRUEBA,
      apiKey: API_KEY_TEST,
      fetch: fetchMock,
      signal: global.signal,
      modo: "bot",
      bot: { escritura: { baseMs: 20_000, variacion: 0 } },
    });

    const r = await cliente.mensajes.enviarTexto({ phone: PHONE, message: "hola" });

    expect(r).toMatchObject({ success: false, codigo: 503, origen: "transporte" });
    expect(eventos).toEqual(["/v1/chats/{phone}/exists", "/v1/chats/{phone}/typing"]);
  });

  it("si el llamador que inició la consulta compartida aborta, el otro recibe su resultado", async () => {
    const { retenida, liberar } = retencion();
    const { mensajes, eventos } = armar({ existe: true, retenerExists: retenida });
    const iniciador = new AbortController();

    const rIniciador = mensajes.enviarTexto(
      { phone: PHONE, message: "uno" },
      { signal: iniciador.signal },
    );
    const rOtro = mensajes.enviarTexto({ phone: PHONE, message: "dos" });
    await vi.waitFor(() => expect(eventos).toEqual(["GET /v1/chats/{phone}/exists"]));
    iniciador.abort();
    liberar();
    const [a, b] = await Promise.all([rIniciador, rOtro]);

    expect(a).toMatchObject({ success: false, codigo: 503, origen: "transporte" });
    expect(b).toEqual({ success: true, data: { message: "ok" } });
    expect(eventos.filter((e) => e.endsWith("/exists"))).toHaveLength(1);
    expect(eventos.filter((e) => e === "POST /v1/send/message")).toHaveLength(1);
  });

  it("la consulta que termina tras abortar el iniciador queda en caché", async () => {
    const { retenida, liberar } = retencion();
    const { mensajes, eventos } = armar({ existe: true, retenerExists: retenida });
    const iniciador = new AbortController();

    const rIniciador = mensajes.enviarTexto(
      { phone: PHONE, message: "uno" },
      { signal: iniciador.signal },
    );
    await vi.waitFor(() => expect(eventos).toEqual(["GET /v1/chats/{phone}/exists"]));
    iniciador.abort();
    await rIniciador;
    liberar();
    await new Promise((resolver) => setTimeout(resolver, 10)); // deja terminar la consulta huérfana
    const r = await mensajes.enviarTexto({ phone: PHONE, message: "dos" });

    expect(r.success).toBe(true);
    expect(eventos.filter((e) => e.endsWith("/exists"))).toHaveLength(1);
  });
});

describe("modo bot: tiempo de escritura", () => {
  it("un texto largo se topa en topeMs y el typing usa segundos redondeados hacia arriba", async () => {
    const { mensajes, eventos, cuerpos } = armar({}, { escritura: { topeMs: 2500 } });

    await mensajes.enviarTexto({ phone: PHONE, message: "x".repeat(5000) });

    expect(eventos).toContain("dormir 2500");
    expect(cuerpos["/v1/chats/{phone}/typing"]).toEqual({ estado: "escribiendo", segundos: 3 });
  });

  it("topeMs 0 desactiva el indicador y la espera", async () => {
    const { mensajes, eventos } = armar({}, { escritura: { topeMs: 0 } });

    await mensajes.enviarTexto({ phone: PHONE, message: "hola" });

    expect(eventos).toEqual(["GET /v1/chats/{phone}/exists", "POST /v1/send/message"]);
  });

  it("una imagen con caption usa el largo del caption", async () => {
    const { mensajes, eventos } = armar();

    await mensajes.enviarImagen({
      phone: PHONE,
      url: "https://example.com/a.png",
      caption: "hola",
    });

    expect(eventos).toContain("dormir 760");
  });

  it("una imagen sin caption usa el tiempo fijo de media", async () => {
    const { mensajes, eventos } = armar();

    await mensajes.enviarImagen({ phone: PHONE, url: "https://example.com/a.png" });

    expect(eventos).toContain("dormir 1200");
  });
});

describe("calcularDuracionEscritura", () => {
  const escritura = { baseMs: 500, msPorCaracter: 10, variacion: 0.5, topeMs: 3000, mediaMs: 800 };

  it("texto: base + ms por carácter, con variación neutra", () => {
    expect(calcularDuracionEscritura({ largoTexto: 100, escritura, aleatorio: () => 0.5 })).toBe(
      1500,
    );
  });

  it("aleatoriedad en los extremos aplica ± variación", () => {
    expect(calcularDuracionEscritura({ largoTexto: 100, escritura, aleatorio: () => 0 })).toBe(750);
    expect(calcularDuracionEscritura({ largoTexto: 100, escritura, aleatorio: () => 1 })).toBe(
      2250,
    );
  });

  it("el tope nunca se supera, ni con la variación al máximo", () => {
    expect(calcularDuracionEscritura({ largoTexto: 10_000, escritura, aleatorio: () => 1 })).toBe(
      3000,
    );
  });

  it("cerca y por encima del tope la variación sigue actuando hacia abajo", () => {
    // nominal 10_000 ms -> recortado a 3000; con variacion 0.5: aleatorio 0 -> x0.5, 0.25 -> x0.75
    expect(calcularDuracionEscritura({ largoTexto: 10_000, escritura, aleatorio: () => 0 })).toBe(
      1500,
    );
    expect(
      calcularDuracionEscritura({ largoTexto: 10_000, escritura, aleatorio: () => 0.25 }),
    ).toBe(2250);
    // nominal justo en el tope (500 + 10 * 250 = 3000)
    expect(calcularDuracionEscritura({ largoTexto: 250, escritura, aleatorio: () => 0.25 })).toBe(
      2250,
    );
  });

  it("una fuente aleatoria fuera de [0, 1] se acota y una no finita cuenta como neutra", () => {
    const duracion = (aleatorio: number) =>
      calcularDuracionEscritura({ largoTexto: 100, escritura, aleatorio: () => aleatorio });

    expect(duracion(-7)).toBe(750);
    expect(duracion(7)).toBe(2250);
    expect(duracion(Number.NaN)).toBe(1500);
  });

  it("sin texto usa mediaMs", () => {
    expect(
      calcularDuracionEscritura({ largoTexto: undefined, escritura, aleatorio: () => 0.5 }),
    ).toBe(800);
  });
});

describe("resolverOpcionesBot", () => {
  it("aplica los defaults documentados", () => {
    const config = resolverOpcionesBot();

    expect(config).toMatchObject({
      verificarExistencia: true,
      siVerificacionFalla: "no_enviar",
      ttlExisteMs: 7 * 24 * 60 * 60 * 1000,
      ttlInexistenteMs: 15 * 60 * 1000,
      escritura: { baseMs: 600, msPorCaracter: 40, variacion: 0.25, topeMs: 6000, mediaMs: 1200 },
    });
  });

  it.each([
    ["topeMs sobre el máximo de la API", { escritura: { topeMs: 25_001 } }, "topeMs"],
    ["variacion mayor que 1", { escritura: { variacion: 1.5 } }, "variacion"],
    ["ttl negativo", { ttlExisteMs: -1 }, "ttlExisteMs"],
    ["aleatorio no función", { aleatorio: 5 as unknown as () => number }, "aleatorio"],
    ["bot null", null, "bot"],
    ["escritura null", { escritura: null }, "escritura"],
  ])("lanza ErrorConfiguracion con %s", (_nombre, opciones, campo) => {
    expect(() => resolverOpcionesBot(opciones as OpcionesModoBot)).toThrow(
      expect.objectContaining({
        name: "ErrorConfiguracion",
        message: expect.stringContaining(campo),
      }),
    );
  });
});

describe("crearCliente con modo bot", () => {
  it("cablea el modo bot: exists, typing y envío por el mismo fetch", async () => {
    const eventos: string[] = [];
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const ruta = new URL(url as string).pathname;
      eventos.push(ruta.replace(/\d{7,15}/, "{phone}"));
      return Promise.resolve(
        ruta.endsWith("/exists")
          ? respuestaJsonData({ exists: true })
          : respuestaJsonData({ message: "ok" }),
      );
    }) as unknown as typeof globalThis.fetch;
    const cliente = crearCliente({
      baseUrl: BASE_URL_PRUEBA,
      apiKey: API_KEY_TEST,
      fetch: fetchMock,
      modo: "bot",
      bot: { escritura: { baseMs: 1, msPorCaracter: 0, topeMs: 2, variacion: 0 } },
    });

    const r = await cliente.mensajes.enviarTexto({ phone: PHONE, message: "hola" });

    expect(r.success).toBe(true);
    expect(eventos).toEqual([
      "/v1/chats/{phone}/exists",
      "/v1/chats/{phone}/typing",
      "/v1/send/message",
    ]);
  });
});

describe("tipos del cliente", () => {
  it("los envíos aceptan messageIds y enviarLote no", () => {
    const cliente = crearCliente({ baseUrl: BASE_URL_PRUEBA, apiKey: API_KEY_TEST });

    expectTypeOf(cliente.mensajes.enviarTexto).parameter(1).toEqualTypeOf<
      | {
          signal?: AbortSignal | undefined;
          timeout?: number | undefined;
          messageIds?: string[];
        }
      | undefined
    >();
    expectTypeOf<
      NonNullable<Parameters<typeof cliente.mensajes.enviarLote>[1]>
    >().not.toHaveProperty("messageIds");
    expectTypeOf<NonNullable<Parameters<typeof cliente.mensajes.enviarTexto>[1]>>().toHaveProperty(
      "messageIds",
    );
  });
});
