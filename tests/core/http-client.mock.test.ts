import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { segmentoRuta } from "../../src/core/http-client/index.js";
import type { Autenticador } from "../../src/core/http-client/index.js";
import { validarEntrada } from "../../src/core/validacion/index.js";
import { API_KEY_TEST } from "../helpers/fixtures.js";
import { crearHttpDePrueba, headersDeLlamada } from "../helpers/http-prueba.js";
import {
  BASE_URL_PRUEBA,
  respuestaError,
  respuestaErrorToken,
  respuestaJson,
  respuestaJsonData,
  respuestaSinContenido,
  respuestaValidacion422,
} from "../helpers/mock-fetch.js";

describe("http-client: respuestas exitosas", () => {
  it("desenvuelve el envelope { data } y valida con el schema", async () => {
    const { http } = crearHttpDePrueba(() => respuestaJsonData({ id: "m1", total: 3 }));

    const r = await http.get("/v1/algo", {
      schemaRespuesta: z.object({ id: z.string(), total: z.number() }),
    });

    expect(r).toEqual({ success: true, data: { id: "m1", total: 3 } });
  });

  it("pasa el JSON completo cuando el envelope trae otras claves", async () => {
    const cuerpo = { data: [1, 2], pagination: { total: 2 } };
    const { http } = crearHttpDePrueba(() => respuestaJson(cuerpo));

    const r = await http.get("/v1/lista");

    expect(r).toEqual({ success: true, data: cuerpo });
  });

  it("retorna data undefined ante 204 sin contenido", async () => {
    const { http } = crearHttpDePrueba(() => respuestaSinContenido());

    const r = await http.delete("/v1/algo/1");

    expect(r).toEqual({ success: true, data: undefined });
  });

  it("retorna 502 si el 2xx no cumple el schema", async () => {
    const { http } = crearHttpDePrueba(() => respuestaJsonData({ id: 123 }));

    const r = await http.get("/v1/algo", { schemaRespuesta: z.object({ id: z.string() }) });

    expect(r).toMatchObject({ success: false, codigo: 502 });
    expect(r.success === false && r.error).toContain("Shape inesperado");
  });

  it("retorna 502 si el 2xx no es JSON", async () => {
    const { http } = crearHttpDePrueba(() => new Response("<html>", { status: 200 }));

    const r = await http.get("/v1/algo");

    expect(r).toMatchObject({ success: false, codigo: 502, error: "Respuesta no es JSON válido" });
  });
});

describe("http-client: request saliente", () => {
  it("envía x-api-key, accept, content-type y body JSON; query omite undefined", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({}));

    await http.post(
      "/v1/send",
      { to: "593", text: "hola" },
      {
        query: { a: 1, b: undefined, c: "x y" },
      },
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL_PRUEBA}/v1/send?a=1&c=x+y`);
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"to":"593","text":"hola"}');
    expect(init.redirect).toBe("error");
    const headers = headersDeLlamada(fetchMock);
    expect(headers.get("x-api-key")).toBe(API_KEY_TEST);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBe("application/json");
  });

  it("los headers del autenticador ganan sobre los extra del consumidor", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({}), {
      headersExtra: { "X-API-KEY": "intento-de-pisar", "x-trace": "t1" },
    });

    await http.get("/v1/algo");

    const headers = headersDeLlamada(fetchMock);
    expect(headers.get("x-api-key")).toBe(API_KEY_TEST);
    expect(headers.get("x-trace")).toBe("t1");
  });

  it("envía FormData sin content-type manual y con cuerpo vacío para el autenticador", async () => {
    const autenticador = vi.fn<Autenticador>(() => ({ "x-api-key": API_KEY_TEST }));
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({}), { autenticador });
    const form = new FormData();
    form.append("to", "593");

    await http.post("/v1/send/image", form);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(form);
    expect(headersDeLlamada(fetchMock).get("content-type")).toBeNull();
    expect(autenticador.mock.calls[0]?.[0].cuerpo.byteLength).toBe(0);
  });

  it("elimina el content-type del consumidor con FormData para que fetch ponga el boundary", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({}), {
      headersExtra: { "Content-Type": "multipart/form-data", "x-trace": "t1" },
    });
    const form = new FormData();
    form.append("to", "593");

    await http.post("/v1/send/image", form);

    const headers = headersDeLlamada(fetchMock);
    expect(headers.get("content-type")).toBeNull();
    expect(headers.get("x-trace")).toBe("t1");
  });

  it("entrega al autenticador método, URL final y bytes exactos del body", async () => {
    const autenticador = vi.fn<Autenticador>(() => ({}));
    const { http } = crearHttpDePrueba(() => respuestaJsonData({}), { autenticador });

    await http.put("/v1/algo", { ñ: 1 }, { query: { k: "v" } });

    const contexto = autenticador.mock.calls[0]?.[0];
    expect(contexto?.method).toBe("PUT");
    expect(contexto?.url.toString()).toBe(`${BASE_URL_PRUEBA}/v1/algo?k=v`);
    expect(new TextDecoder().decode(contexto?.cuerpo)).toBe('{"ñ":1}');
  });

  it("retorna 500 sin llamar a fetch si el autenticador lanza", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({}), {
      autenticador: () => {
        throw new Error("secreto-que-no-debe-filtrarse");
      },
    });

    const r = await http.get("/v1/algo");

    expect(r).toEqual({
      success: false,
      codigo: 500,
      origen: "local",
      error: "No se pudo autenticar la petición",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["sin barra inicial", "v1/algo"],
    ["host externo con //", "//evil.example/x"],
    ["segmento ..", `/v1/${segmentoRuta("..")}/x`],
    ["segmento %2e%2e", "/v1/%2e%2e/x"],
    ["query incrustado", "/v1/algo?x=1"],
  ])("rechaza con 400 y no llama a fetch una ruta insegura (%s)", async (_caso, ruta) => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({}));

    const r = await http.get(ruta);

    expect(r).toEqual({ success: false, codigo: 400, origen: "local", error: "Ruta inválida" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("acepta un id con caracteres reservados codificado con segmentoRuta", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({}));

    await http.get(`/v1/items/${segmentoRuta("a/b?c#d")}`);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE_URL_PRUEBA}/v1/items/a%2Fb%3Fc%23d`);
  });

  it("retorna 400 si el body no es serializable", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({}));

    const r = await http.post("/v1/algo", { n: 10n });

    expect(r).toEqual({
      success: false,
      codigo: 400,
      origen: "local",
      error: "El cuerpo no es serializable a JSON",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("http-client: mapeo de errores de la API", () => {
  it("usa el mensaje { error: string } de la API y expone el requestId", async () => {
    const { http } = crearHttpDePrueba(() =>
      respuestaError(404, "Sesión no encontrada", { "x-request-id": "req-123" }),
    );

    const r = await http.get("/v1/sesion");

    expect(r).toEqual({
      success: false,
      codigo: 404,
      origen: "api",
      error: "Sesión no encontrada",
      requestId: "req-123",
    });
  });

  it("expone detalles del 422 de validación", async () => {
    const { http } = crearHttpDePrueba(() => respuestaValidacion422({ to: ["Requerido"] }));

    const r = await http.post("/v1/send", {});

    expect(r).toEqual({
      success: false,
      codigo: 422,
      origen: "api",
      error: "Body inválido",
      detalles: { formErrors: [], fieldErrors: { to: ["Requerido"] } },
    });
  });

  it("mapea el 401 S2S { error: { code, message } } con codigoApi", async () => {
    const { http } = crearHttpDePrueba(() => respuestaErrorToken());

    const r = await http.get("/v1/admin/x");

    expect(r).toEqual({
      success: false,
      codigo: 401,
      origen: "api",
      error: "Acceso no autorizado",
      codigoApi: "unauthorized",
    });
  });

  it("usa un mensaje estable si el cuerpo de error no es JSON", async () => {
    const { http } = crearHttpDePrueba(() => new Response("boom", { status: 403 }));

    const r = await http.get("/v1/algo");

    expect(r).toEqual({ success: false, codigo: 403, origen: "api", error: "Acceso prohibido" });
  });

  it("mapea un status fuera del contrato (418) a 502", async () => {
    const { http } = crearHttpDePrueba(() => respuestaError(418, "tetera"));

    const r = await http.get("/v1/algo");

    expect(r).toEqual({
      success: false,
      codigo: 502,
      origen: "api",
      error: "Status HTTP inesperado: 418",
    });
  });

  it("mapea 429 con retryAfter numérico", async () => {
    const { http } = crearHttpDePrueba(() =>
      respuestaError(429, "Demasiadas solicitudes, intenta más tarde", { "Retry-After": "7" }),
    );

    const r = await http.post("/v1/send", {});

    expect(r).toEqual({
      success: false,
      codigo: 429,
      origen: "api",
      error: "Demasiadas solicitudes, intenta más tarde",
      retryAfter: 7,
    });
  });

  it("mapea 429 con Retry-After como fecha HTTP a segundos relativos", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const { http } = crearHttpDePrueba(() =>
        respuestaError(429, "x", { "Retry-After": "Thu, 01 Jan 2026 00:00:30 GMT" }),
      );

      const r = await http.post("/v1/send", {});

      expect(r).toMatchObject({ codigo: 429, retryAfter: 30 });
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignora un Retry-After malformado", async () => {
    const { http } = crearHttpDePrueba(() => respuestaError(429, "x", { "Retry-After": "pronto" }));

    const r = await http.post("/v1/send", {});

    expect(r).toEqual({ success: false, codigo: 429, origen: "api", error: "x" });
  });
});

describe("http-client: fallos técnicos", () => {
  it("retorna 503 ante error de red", async () => {
    const { http } = crearHttpDePrueba(() => {
      throw new TypeError("fetch failed");
    });

    const r = await http.get("/v1/algo");

    expect(r).toEqual({
      success: false,
      codigo: 503,
      origen: "transporte",
      error: "Error de red al comunicarse con el servicio",
    });
  });

  it("retorna 503 'Tiempo de espera agotado' cuando vence el timeout", async () => {
    const { http } = crearHttpDePrueba(
      (_url, init) =>
        new Promise<Response>((_resolver, rechazar) => {
          init.signal?.addEventListener("abort", () =>
            rechazar(new DOMException("aborted", "AbortError")),
          );
        }),
      { timeout: 20 },
    );

    const r = await http.get("/v1/algo");

    expect(r).toEqual({
      success: false,
      codigo: 503,
      origen: "transporte",
      error: "Tiempo de espera agotado",
    });
  });

  it("retorna 503 'Operación cancelada' si el consumidor aborta, sin reintentar", async () => {
    const control = new AbortController();
    const { http, fetchMock } = crearHttpDePrueba(
      (_url, init) =>
        new Promise<Response>((_resolver, rechazar) => {
          init.signal?.addEventListener("abort", () =>
            rechazar(new DOMException("aborted", "AbortError")),
          );
          control.abort();
        }),
      { reintentos: { maximo: 3 } },
    );

    const r = await http.get("/v1/algo", { signal: control.signal });

    expect(r).toEqual({
      success: false,
      codigo: 503,
      origen: "transporte",
      error: "Operación cancelada",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retorna 503 de redirect sin reintentar", async () => {
    const { http, fetchMock } = crearHttpDePrueba(
      () => {
        throw new TypeError("fetch failed", { cause: new Error("unexpected redirect") });
      },
      { reintentos: { maximo: 2 } },
    );

    const r = await http.get("/v1/algo");

    expect(r).toEqual({
      success: false,
      codigo: 503,
      origen: "transporte",
      error: "Redirect inesperado rechazado por seguridad",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("http-client: origen del error", () => {
  it("distingue un 503 real de la API de un 503 de transporte", async () => {
    const api = crearHttpDePrueba(() => respuestaError(503, "caído"));
    const red = crearHttpDePrueba(() => {
      throw new TypeError("fetch failed");
    });

    const deApi = await api.http.post("/v1/send", {});
    const deRed = await red.http.post("/v1/send", {});

    expect(deApi).toMatchObject({ codigo: 503, origen: "api", error: "caído" });
    expect(deRed).toMatchObject({ codigo: 503, origen: "transporte" });
  });

  it("marca origen api la respuesta 2xx con shape inesperado y local la validación 422", async () => {
    const { http } = crearHttpDePrueba(() => respuestaJsonData({ id: 123 }));

    const parseo = await http.get("/v1/algo", { schemaRespuesta: z.object({ id: z.string() }) });
    const local = validarEntrada(z.object({ a: z.string() }), {});

    expect(parseo).toMatchObject({ codigo: 502, origen: "api" });
    expect(local).toMatchObject({ codigo: 422, origen: "local" });
  });
});

describe("http-client: reintentos", () => {
  it("reintenta un GET ante 503 y retorna el éxito posterior", async () => {
    const respuestas = [respuestaError(503, "caído"), respuestaJsonData({ ok: true })];
    const { http, fetchMock } = crearHttpDePrueba(() => respuestas.shift() as Response, {
      reintentos: { maximo: 2 },
    });

    const r = await http.get("/v1/algo");

    expect(r).toEqual({ success: true, data: { ok: true } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reintenta un DELETE ante error de red", async () => {
    let llamadas = 0;
    const { http, fetchMock } = crearHttpDePrueba(
      () => {
        llamadas += 1;
        if (llamadas === 1) throw new TypeError("fetch failed");
        return respuestaSinContenido();
      },
      { reintentos: { maximo: 1 } },
    );

    const r = await http.delete("/v1/algo/1");

    expect(r).toEqual({ success: true, data: undefined });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("agota los reintentos y retorna el último error", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaError(500, "falla"), {
      reintentos: { maximo: 2 },
    });

    const r = await http.get("/v1/algo");

    expect(r).toMatchObject({ success: false, codigo: 500, error: "falla" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each(["POST", "PUT"] as const)("nunca reintenta un %s", async (metodo) => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaError(503, "caído"), {
      reintentos: { maximo: 3 },
    });

    const r = await http.request({ method: metodo, path: "/v1/algo", body: {} });

    expect(r).toMatchObject({ success: false, codigo: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reintentar: false desactiva los reintentos de un GET", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaError(503, "caído"), {
      reintentos: { maximo: 3 },
    });

    const r = await http.get("/v1/algo", { reintentar: false });

    expect(r).toMatchObject({ success: false, codigo: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reintentar: true habilita los reintentos de un POST", async () => {
    const respuestas = [respuestaError(503, "caído"), respuestaJsonData({ ok: true })];
    const { http, fetchMock } = crearHttpDePrueba(() => respuestas.shift() as Response, {
      reintentos: { maximo: 2 },
    });

    const r = await http.post("/v1/algo", {}, { reintentar: true });

    expect(r).toEqual({ success: true, data: { ok: true } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("no reintenta un 4xx distinto de 429", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaError(404, "no existe"), {
      reintentos: { maximo: 3 },
    });

    await http.get("/v1/algo");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("espera lo que pide Retry-After (en ms) antes de reintentar un 429", async () => {
    const dormir = vi.fn<(ms: number, signal?: AbortSignal) => Promise<void>>(() =>
      Promise.resolve(),
    );
    const respuestas = [respuestaError(429, "lento", { "Retry-After": "2" }), respuestaJsonData(1)];
    const { http } = crearHttpDePrueba(() => respuestas.shift() as Response, {
      reintentos: { maximo: 1 },
      dormir,
    });

    const r = await http.get("/v1/algo");

    expect(r).toEqual({ success: true, data: 1 });
    expect(dormir).toHaveBeenCalledTimes(1);
    expect(dormir.mock.calls[0]?.[0]).toBe(2000);
  });

  it("no reintenta si Retry-After supera la espera máxima y entrega retryAfter", async () => {
    const dormir = vi.fn<(ms: number, signal?: AbortSignal) => Promise<void>>(() =>
      Promise.resolve(),
    );
    const { http, fetchMock } = crearHttpDePrueba(
      () => respuestaError(429, "lento", { "Retry-After": "60" }),
      { reintentos: { maximo: 2, esperaMaximaMs: 5_000 }, dormir },
    );

    const r = await http.get("/v1/algo");

    expect(r).toMatchObject({ success: false, codigo: 429, retryAfter: 60 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(dormir).not.toHaveBeenCalled();
  });

  it("aplica backoff exponencial con jitter acotado entre intentos", async () => {
    const dormir = vi.fn<(ms: number, signal?: AbortSignal) => Promise<void>>(() =>
      Promise.resolve(),
    );
    const { http } = crearHttpDePrueba(() => respuestaError(500, "falla"), {
      reintentos: { maximo: 3, esperaBaseMs: 100, esperaMaximaMs: 350 },
      dormir,
      aleatorio: () => 1,
    });

    await http.get("/v1/algo");

    // aleatorio=1 -> sin recorte: 100, 200, y 400 topado en 350.
    expect(dormir.mock.calls.map((c) => c[0])).toEqual([100, 200, 350]);
  });

  it("vuelve a invocar el autenticador en cada intento (el token puede cambiar entre intentos)", async () => {
    let n = 0;
    const autenticador = vi.fn<Autenticador>(() => ({ "x-nonce": String((n += 1)) }));
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaError(500, "falla"), {
      autenticador,
      reintentos: { maximo: 1 },
    });

    await http.get("/v1/algo");

    expect(autenticador).toHaveBeenCalledTimes(2);
    expect(headersDeLlamada(fetchMock, 0).get("x-nonce")).toBe("1");
    expect(headersDeLlamada(fetchMock, 1).get("x-nonce")).toBe("2");
  });
});

describe("http-client: reintento único ante 401 (autenticador con ante401)", () => {
  const autenticadorConHook = (ante401: (h: Headers) => void): Autenticador =>
    Object.assign(() => ({ authorization: "Bearer t" }), { ante401 });

  const secuencia = (...respuestas: Array<() => Response>) => {
    let i = 0;
    return () => (respuestas[Math.min(i++, respuestas.length - 1)] as () => Response)();
  };

  it("reintenta una vez un POST tras un 401 y devuelve el éxito", async () => {
    const ante401 = vi.fn();
    const { http, fetchMock } = crearHttpDePrueba(
      secuencia(
        () => respuestaErrorToken(),
        () => respuestaJsonData({ ok: true }),
      ),
      { autenticador: autenticadorConHook(ante401) },
    );

    const r = await http.post("/v1/algo", { a: 1 });

    expect(r).toEqual({ success: true, data: { ok: true } });
    expect(ante401).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("entrega a ante401 los headers que fueron rechazados", async () => {
    const ante401 = vi.fn();
    const { http } = crearHttpDePrueba(
      secuencia(
        () => respuestaErrorToken(),
        () => respuestaJsonData({ ok: true }),
      ),
      { autenticador: autenticadorConHook(ante401) },
    );

    await http.get("/v1/algo");

    const headers = ante401.mock.calls[0]?.[0] as Headers;
    expect(headers.get("authorization")).toBe("Bearer t");
  });

  it("si ante401 lanza devuelve el 401 sin reintentar ni lanzar", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaErrorToken(), {
      autenticador: autenticadorConHook(() => {
        throw new Error("boom");
      }),
    });

    const r = await http.post("/v1/algo", {});

    expect(r).toMatchObject({ success: false, codigo: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no reintenta un segundo 401: devuelve el fallo tras una sola invalidación", async () => {
    const ante401 = vi.fn();
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaErrorToken(), {
      autenticador: autenticadorConHook(ante401),
      reintentos: { maximo: 3, esperaBaseMs: 0, esperaMaximaMs: 0 },
    });

    const r = await http.get("/v1/algo");

    expect(r).toMatchObject({ success: false, codigo: 401 });
    expect(ante401).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("no consume el presupuesto de reintentos por 5xx", async () => {
    const { http, fetchMock } = crearHttpDePrueba(
      secuencia(
        () => respuestaErrorToken(),
        () => respuestaError(503, "caído"),
        () => respuestaJsonData({ ok: true }),
      ),
      {
        autenticador: autenticadorConHook(vi.fn()),
        reintentos: { maximo: 1, esperaBaseMs: 0, esperaMaximaMs: 0 },
      },
    );

    const r = await http.get("/v1/algo");

    expect(r).toEqual({ success: true, data: { ok: true } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("no reintenta ante 403", async () => {
    const ante401 = vi.fn();
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaError(403, "Sin permiso"), {
      autenticador: autenticadorConHook(ante401),
    });

    const r = await http.post("/v1/algo", {});

    expect(r).toMatchObject({ success: false, codigo: 403 });
    expect(ante401).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sin ante401 un 401 no se reintenta (x-api-key)", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaErrorToken());

    const r = await http.get("/v1/algo");

    expect(r).toMatchObject({ success: false, codigo: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
