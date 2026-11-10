import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { ErrorConfiguracion } from "../../../src/core/errors/index.js";
import { crearFacadeChatsInternos } from "../../../src/features/internal-chats/index.js";
import { crearFacadeMensajesInternos } from "../../../src/features/internal-mensajes/index.js";
import {
  aplicarModoBotInterno,
  resolverOpcionesBot,
} from "../../../src/features/modo-bot/index.js";
import type { OpcionesModoBot } from "../../../src/features/modo-bot/index.js";
import { crearClienteInterno } from "../../../src/internal.js";
import { TOKEN_SERVICIO_TEST } from "../../helpers/fixtures.js";
import { crearHttpDePrueba } from "../../helpers/http-prueba.js";
import { BASE_URL_PRUEBA, respuestaError, respuestaJsonData } from "../../helpers/mock-fetch.js";

const PHONE = "51999999999";
const OTRO_PHONE = "51977777777";
const SOURCE = "51988888888";
const OTRO_SOURCE = "51966666666";
const TEXTO = { phone: PHONE, message: "Tu código es 123456", sourcePhone: SOURCE };

interface Escenario {
  /** Se lee en cada llamada: un test puede mutarlo entre envíos. */
  existe?: boolean | "429" | "503";
  retenerExists?: Promise<void>;
  typingFalla?: boolean;
}

/** Arma facades internas reales contra un fetch simulado; `eventos` registra llamadas y esperas en orden. */
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
  const llamadas: { ruta: string; query: Record<string, string>; cuerpo: unknown }[] = [];
  const { http } = crearHttpDePrueba(
    async (url, init) => {
      const destino = new URL(url);
      const ruta = destino.pathname.replace(/\d{7,15}/, "{phone}");
      eventos.push(`${init.method ?? "GET"} ${ruta}`);
      llamadas.push({
        ruta,
        query: Object.fromEntries(destino.searchParams),
        cuerpo: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
      });
      if (ruta.endsWith("/exists")) {
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
        if (escenario.existe === "503") return respuestaError(503, "Sesión no disponible");
        return respuestaJsonData({ exists: escenario.existe ?? true });
      }
      if (ruta.endsWith("/typing") && escenario.typingFalla === true) {
        return respuestaError(503, "Sesión no disponible");
      }
      return respuestaJsonData({ message: "ok" });
    },
    { clientSignal: signalCliente },
  );
  const advertencias: { paso: string; codigo: number }[] = [];
  const config = resolverOpcionesBot({
    aleatorio: () => 0.5,
    alAdvertir: (a) => advertencias.push({ paso: a.paso, codigo: a.error.codigo }),
    ...bot,
  });
  const mensajes = aplicarModoBotInterno({
    mensajes: crearFacadeMensajesInternos(http),
    chats: crearFacadeChatsInternos(http),
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
  return { mensajes, eventos, llamadas, advertencias };
};

describe("interno modo bot: orden de llamadas", () => {
  it("verifica, escribe, espera y recién entonces envía, todo por la vía interna", async () => {
    const { mensajes, eventos } = armar();

    const r = await mensajes.enviar(TEXTO);

    expect(r).toEqual({ success: true, data: { message: "ok" } });
    // "Tu código es 123456" = 19 caracteres: 600 + 40 * 19 = 1360 ms (variación neutra).
    expect(eventos).toEqual([
      "GET /v1/internal/chats/{phone}/exists",
      "POST /v1/internal/chats/{phone}/typing",
      "dormir 1360",
      "POST /v1/internal/messages/send",
    ]);
  });

  it("propaga sourcePhone al exists (query) y al typing (body)", async () => {
    const { mensajes, llamadas } = armar();

    await mensajes.enviar(TEXTO);

    expect(llamadas[0]).toMatchObject({ query: { sourcePhone: SOURCE } });
    expect(llamadas[1]?.cuerpo).toEqual({
      sourcePhone: SOURCE,
      estado: "escribiendo",
      segundos: 2,
    });
    expect(llamadas[2]?.cuerpo).toEqual(TEXTO);
  });

  it("una media con caption usa el largo del caption y envía la media", async () => {
    const { mensajes, eventos, llamadas } = armar();
    const media = {
      phone: PHONE,
      sourcePhone: SOURCE,
      mediaUrl: "https://example.com/recibo.pdf",
      caption: "Recibo",
      mediaType: "document",
    } as const;

    const r = await mensajes.enviar(media);

    expect(r.success).toBe(true);
    expect(eventos).toContain("dormir 840"); // 600 + 40 * 6
    expect(llamadas.at(-1)?.cuerpo).toEqual(media);
  });

  it("una media sin caption espera el tiempo fijo de media", async () => {
    const { mensajes, eventos } = armar();

    await mensajes.enviar({
      phone: PHONE,
      sourcePhone: SOURCE,
      mediaUrl: "https://example.com/foto.png",
      mediaType: "image",
    });

    expect(eventos).toContain("dormir 1200");
  });

  it("topeMs 0 desactiva el indicador y la espera", async () => {
    const { mensajes, eventos } = armar({}, { escritura: { topeMs: 0 } });

    await mensajes.enviar(TEXTO);

    expect(eventos).toEqual([
      "GET /v1/internal/chats/{phone}/exists",
      "POST /v1/internal/messages/send",
    ]);
  });

  it("un input inválido pasa al envío, que responde 422 local sin llamadas extra", async () => {
    const { mensajes, eventos } = armar();

    const r = await mensajes.enviar({ phone: PHONE, message: "hola", sourcePhone: "1" });

    expect(r).toMatchObject({ success: false, codigo: 422, origen: "local" });
    expect(eventos).toEqual([]);
  });

  it("ignora messageIds en runtime: nunca llama a read", async () => {
    const { mensajes, eventos } = armar();
    const enviar = mensajes.enviar as (
      i: unknown,
      o: unknown,
    ) => ReturnType<typeof mensajes.enviar>;

    await enviar(TEXTO, { messageIds: ["A1"] });

    expect(eventos.some((e) => e.endsWith("/read"))).toBe(false);
  });
});

describe("interno modo bot: número sin WhatsApp", () => {
  it("devuelve 404 local numero_sin_whatsapp y no escribe ni envía", async () => {
    const { mensajes, eventos } = armar({ existe: false });

    const r = await mensajes.enviar(TEXTO);

    expect(r).toMatchObject({
      success: false,
      codigo: 404,
      origen: "local",
      codigoApi: "numero_sin_whatsapp",
    });
    expect(eventos).toEqual(["GET /v1/internal/chats/{phone}/exists"]);
  });
});

describe("interno modo bot: verificación caída", () => {
  it('con "no_enviar" (default) devuelve verificacion_no_disponible conservando retryAfter y no envía', async () => {
    const { mensajes, eventos } = armar({ existe: "429" });

    const r = await mensajes.enviar(TEXTO);

    expect(r).toMatchObject({
      success: false,
      codigo: 429,
      origen: "api",
      codigoApi: "verificacion_no_disponible",
      retryAfter: 1800,
    });
    expect(eventos).toEqual(["GET /v1/internal/chats/{phone}/exists"]);
  });

  it('con "enviar" avisa por alAdvertir, escribe y envía; no cachea el fallo', async () => {
    const escenario: Escenario = { existe: "503" };
    const { mensajes, eventos, advertencias } = armar(escenario, { siVerificacionFalla: "enviar" });

    const r = await mensajes.enviar(TEXTO);
    escenario.existe = true;
    await mensajes.enviar(TEXTO);

    expect(r.success).toBe(true);
    expect(advertencias).toEqual([{ paso: "verificar", codigo: 503 }]);
    expect(eventos.filter((e) => e.endsWith("/exists"))).toHaveLength(2);
    expect(eventos.filter((e) => e.endsWith("/messages/send"))).toHaveLength(2);
  });

  it("un fallo de typing avisa, no espera y envía igual", async () => {
    const { mensajes, eventos, advertencias } = armar({ typingFalla: true });

    const r = await mensajes.enviar(TEXTO);

    expect(r.success).toBe(true);
    expect(advertencias).toEqual([{ paso: "escribir", codigo: 503 }]);
    expect(eventos.some((e) => e.startsWith("dormir"))).toBe(false);
    expect(eventos.at(-1)).toBe("POST /v1/internal/messages/send");
  });
});

describe("interno modo bot: caché de existencia", () => {
  it("consulta exists una sola vez por destino aunque se envíen varios mensajes", async () => {
    const { mensajes, eventos } = armar();

    await mensajes.enviar(TEXTO);
    await mensajes.enviar(TEXTO);

    expect(eventos.filter((e) => e.endsWith("/exists"))).toHaveLength(1);
    expect(eventos.filter((e) => e.endsWith("/messages/send"))).toHaveLength(2);
  });

  it("la caché se indexa por destino: otro sourcePhone reutiliza el dato", async () => {
    const { mensajes, eventos } = armar();

    await mensajes.enviar(TEXTO);
    await mensajes.enviar({ ...TEXTO, sourcePhone: OTRO_SOURCE });

    expect(eventos.filter((e) => e.endsWith("/exists"))).toHaveLength(1);
  });

  it("otro destino consulta de nuevo", async () => {
    const { mensajes, eventos } = armar();

    await mensajes.enviar(TEXTO);
    await mensajes.enviar({ ...TEXTO, phone: OTRO_PHONE });

    expect(eventos.filter((e) => e.endsWith("/exists"))).toHaveLength(2);
  });

  it("envíos simultáneos al mismo destino comparten una sola consulta", async () => {
    let liberar: () => void = () => {};
    const retenerExists = new Promise<void>((r) => (liberar = r));
    const { mensajes, eventos } = armar({ retenerExists });

    const a = mensajes.enviar(TEXTO);
    const b = mensajes.enviar(TEXTO);
    await vi.waitFor(() => expect(eventos).toContain("GET /v1/internal/chats/{phone}/exists"));
    liberar();
    await Promise.all([a, b]);

    expect(eventos.filter((e) => e.endsWith("/exists"))).toHaveLength(1);
  });

  it("vuelve a consultar cuando vence el TTL del positivo", async () => {
    let ahora = 0;
    const { mensajes, eventos } = armar({}, { ttlExisteMs: 1000 }, { ahora: () => ahora });

    await mensajes.enviar(TEXTO);
    ahora = 1001;
    await mensajes.enviar(TEXTO);

    expect(eventos.filter((e) => e.endsWith("/exists"))).toHaveLength(2);
  });

  it("verificarExistencia: false no consulta exists", async () => {
    const { mensajes, eventos } = armar({}, { verificarExistencia: false });

    await mensajes.enviar(TEXTO);

    expect(eventos.some((e) => e.endsWith("/exists"))).toBe(false);
  });
});

describe("interno modo bot: cancelación", () => {
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

    const pendiente = mensajes.enviar(TEXTO, { signal: controlador.signal });
    await vi.waitFor(() => expect(visto.signal).toBeDefined());
    controlador.abort();
    const r = await pendiente;

    expect(r).toMatchObject({ success: false, codigo: 503, origen: "transporte" });
    expect(eventos).not.toContain("POST /v1/internal/messages/send");
  });

  it("abortar el signal global durante la espera devuelve el error de abort y no envía", async () => {
    const { visto, dormir } = dormirHastaAbort();
    const global = new AbortController();
    const { mensajes, eventos } = armar({}, {}, { dormir }, global.signal);

    const pendiente = mensajes.enviar(TEXTO);
    await vi.waitFor(() => expect(visto.signal).toBeDefined());
    global.abort();
    const r = await pendiente;

    expect(r).toMatchObject({ success: false, codigo: 503, origen: "transporte" });
    expect(eventos).not.toContain("POST /v1/internal/messages/send");
  });

  it("un signal ya abortado no hace ninguna llamada", async () => {
    const { mensajes, eventos } = armar();
    const controlador = new AbortController();
    controlador.abort();

    const r = await mensajes.enviar(TEXTO, { signal: controlador.signal });

    expect(r).toMatchObject({ success: false, codigo: 503, origen: "transporte" });
    expect(eventos).toEqual([]);
  });
});

describe("crearClienteInterno: modo", () => {
  const base = {
    baseUrl: BASE_URL_PRUEBA,
    obtenerToken: () => Promise.resolve(TOKEN_SERVICIO_TEST),
  };

  it("modo humano (default): un envío hace una sola llamada", async () => {
    const rutas: string[] = [];
    const fetchMock = vi.fn((url: string | URL | Request) => {
      rutas.push(new URL(url as string).pathname);
      return Promise.resolve(respuestaJsonData({ message: "ok" }));
    }) as unknown as typeof globalThis.fetch;
    const interno = crearClienteInterno({ ...base, fetch: fetchMock });

    const r = await interno.mensajes.enviar(TEXTO);

    expect(r.success).toBe(true);
    expect(rutas).toEqual(["/v1/internal/messages/send"]);
  });

  it("modo bot: cablea exists, typing y envío por el mismo fetch con Bearer", async () => {
    const llamadas: { ruta: string; auth: string | null }[] = [];
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const ruta = new URL(url as string).pathname;
      llamadas.push({
        ruta: ruta.replace(/\d{7,15}/, "{phone}"),
        auth: new Headers(init?.headers).get("authorization"),
      });
      return Promise.resolve(
        respuestaJsonData(ruta.endsWith("/exists") ? { exists: true } : { message: "ok" }),
      );
    }) as unknown as typeof globalThis.fetch;
    const interno = crearClienteInterno({
      ...base,
      fetch: fetchMock,
      modo: "bot",
      bot: { escritura: { baseMs: 1, msPorCaracter: 0, topeMs: 2, variacion: 0 } },
    });

    const r = await interno.mensajes.enviar(TEXTO);

    expect(r.success).toBe(true);
    expect(llamadas.map((l) => l.ruta)).toEqual([
      "/v1/internal/chats/{phone}/exists",
      "/v1/internal/chats/{phone}/typing",
      "/v1/internal/messages/send",
    ]);
    expect(llamadas.every((l) => l.auth === `Bearer ${TOKEN_SERVICIO_TEST}`)).toBe(true);
  });

  it("rechaza `bot` sin modo bot y un modo desconocido", () => {
    expect(() => crearClienteInterno({ ...base, bot: {} })).toThrow(ErrorConfiguracion);
    expect(() => crearClienteInterno({ ...base, modo: "robot" as unknown as "bot" })).toThrow(
      ErrorConfiguracion,
    );
  });

  it("valida las opciones del bot", () => {
    expect(() => crearClienteInterno({ ...base, modo: "bot", bot: { ttlExisteMs: -1 } })).toThrow(
      ErrorConfiguracion,
    );
  });

  it("el tipo de enviar no expone messageIds", () => {
    const interno = crearClienteInterno(base);

    expectTypeOf<NonNullable<Parameters<typeof interno.mensajes.enviar>[1]>>().not.toHaveProperty(
      "messageIds",
    );
  });
});

describe("interno modo bot: destino y entrada inválidos", () => {
  it.each([
    ["con +", `+${PHONE}`],
    ["de 16 dígitos", "5199999999912345"],
    ["de 20 dígitos", "51999999999123456789"],
  ])("un phone %s va directo al envío, sin pasos de bot", async (_nombre, phone) => {
    const { mensajes, eventos } = armar();

    const r = await mensajes.enviar({ ...TEXTO, phone });

    expect(r.success).toBe(true);
    expect(eventos).toEqual(["POST /v1/internal/messages/send"]);
  });

  it.each([null, undefined])("enviar(%s) devuelve 422 local sin lanzar", async (entrada) => {
    const { mensajes, eventos } = armar();

    const r = await mensajes.enviar(entrada as unknown as Parameters<typeof mensajes.enviar>[0]);

    expect(r).toMatchObject({ success: false, codigo: 422, origen: "local" });
    expect(eventos).toEqual([]);
  });
});

describe("interno modo bot: consulta en vuelo por remitente", () => {
  it("un remitente que falla no contagia su error a otro que consulta el mismo destino a la vez", async () => {
    let liberar: () => void = () => {};
    const retener = new Promise<void>((r) => (liberar = r));
    const { http } = crearHttpDePrueba(async (url) => {
      const destino = new URL(url);
      if (destino.pathname.endsWith("/exists")) {
        await retener;
        return destino.searchParams.get("sourcePhone") === OTRO_SOURCE
          ? respuestaError(403, "sourcePhone no permitido")
          : respuestaJsonData({ exists: true });
      }
      return respuestaJsonData({ message: "ok" });
    });
    const mensajes = aplicarModoBotInterno({
      mensajes: crearFacadeMensajesInternos(http),
      chats: crearFacadeChatsInternos(http),
      config: resolverOpcionesBot({ aleatorio: () => 0.5 }),
      costuras: { dormir: () => Promise.resolve() },
    });

    const malo = mensajes.enviar({ ...TEXTO, sourcePhone: OTRO_SOURCE });
    const sano = mensajes.enviar(TEXTO);
    liberar();
    const [rMalo, rSano] = await Promise.all([malo, sano]);

    expect(rMalo).toMatchObject({ success: false, codigo: 403 });
    expect(rSano).toEqual({ success: true, data: { message: "ok" } });
  });
});
