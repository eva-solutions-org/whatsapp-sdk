import { recolectar } from "../../helpers/iteradores.js";
import { describe, expect, it } from "vitest";
import { crearFacadeWebhooksFallidos } from "../../../src/features/webhooks-fallidos/index.js";
import { crearHttpDePrueba } from "../../helpers/http-prueba.js";
import {
  BASE_URL_PRUEBA,
  respuestaError,
  respuestaJson,
  respuestaJsonData,
} from "../../helpers/mock-fetch.js";

type MockConLlamadas = { mock: { calls: unknown[][] } };
const urlDe = (m: MockConLlamadas) => m.mock.calls[0]?.[0] as string;
const initDe = (m: MockConLlamadas) => m.mock.calls[0]?.[1] as RequestInit;

/** Forma real de `webhookEventoFallidoSchema` de la API. */
const EVENTO = {
  id: 12,
  phone: "593999999999",
  tipoEvento: "message",
  payload: '{"type":"message"}',
  codigoEstado: 500,
  mensajeError: "HTTP 500",
  estado: "agotado",
  intentos: 5,
  maxIntentos: 5,
  proximoReintento: null,
  createdAt: "2026-03-22T10:00:00.000Z",
  updatedAt: "2026-03-22T11:00:00.000Z",
} as const;

describe("webhooksFallidos.listar", () => {
  const LISTA = {
    data: [EVENTO],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  it("manda page, limit y estado en el query y devuelve data + pagination", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJson(LISTA));

    const r = await crearFacadeWebhooksFallidos(http).listar({
      page: 1,
      limit: 20,
      estado: "agotado",
    });

    expect(r).toEqual({ success: true, data: LISTA });
    expect(urlDe(fetchMock)).toBe(
      `${BASE_URL_PRUEBA}/v1/me/webhooks/failed?page=1&limit=20&estado=agotado`,
    );
    expect(initDe(fetchMock).method).toBe("GET");
  });

  it("rechaza un estado desconocido sin llamar a la red", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJson(LISTA));

    const r = await crearFacadeWebhooksFallidos(http).listar({ estado: "roto" as never });

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mapea el 422 de la API", async () => {
    const { http } = crearHttpDePrueba(() => respuestaError(422, "Body inválido"));

    const r = await crearFacadeWebhooksFallidos(http).listar();

    expect(r).toMatchObject({ success: false, codigo: 422, error: "Body inválido" });
  });
});

describe("webhooksFallidos.reintentar", () => {
  it("hace POST sin body a /v1/me/webhooks/failed/{id}/retry", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() =>
      respuestaJsonData({ message: "Reintento programado" }),
    );

    const r = await crearFacadeWebhooksFallidos(http).reintentar(12);

    expect(r).toEqual({ success: true, data: { message: "Reintento programado" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/webhooks/failed/12/retry`);
    expect(initDe(fetchMock).method).toBe("POST");
    expect(initDe(fetchMock).body).toBeUndefined();
  });

  it("mapea el 404", async () => {
    const { http } = crearHttpDePrueba(() => respuestaError(404, "Evento no encontrado"));

    const r = await crearFacadeWebhooksFallidos(http).reintentar(99);

    expect(r).toMatchObject({ success: false, codigo: 404, error: "Evento no encontrado" });
  });
});

describe("webhooksFallidos.reintentarTodos", () => {
  it("hace POST a /v1/me/webhooks/failed/drain y devuelve { message }", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() =>
      respuestaJsonData({ message: "3 eventos reprogramados para reintento" }),
    );

    const r = await crearFacadeWebhooksFallidos(http).reintentarTodos();

    expect(r).toEqual({
      success: true,
      data: { message: "3 eventos reprogramados para reintento" },
    });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/webhooks/failed/drain`);
    expect(initDe(fetchMock).method).toBe("POST");
  });

  it("mapea el 429 con retryAfter", async () => {
    const { http } = crearHttpDePrueba(() =>
      respuestaError(429, "Demasiadas solicitudes", { "Retry-After": "30" }),
    );

    const r = await crearFacadeWebhooksFallidos(http).reintentarTodos();

    expect(r).toMatchObject({ success: false, codigo: 429, retryAfter: 30 });
  });
});

describe("webhooksFallidos.descartar", () => {
  it("hace DELETE a /v1/me/webhooks/failed/{id}", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() =>
      respuestaJsonData({ message: "Evento descartado" }),
    );

    const r = await crearFacadeWebhooksFallidos(http).descartar(12);

    expect(r).toEqual({ success: true, data: { message: "Evento descartado" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/webhooks/failed/12`);
    expect(initDe(fetchMock).method).toBe("DELETE");
  });

  it("mapea el 404", async () => {
    const { http } = crearHttpDePrueba(() => respuestaError(404, "Evento no encontrado"));

    const r = await crearFacadeWebhooksFallidos(http).descartar(12);

    expect(r).toMatchObject({ success: false, codigo: 404 });
  });
});

describe("webhooksFallidos.iterar", () => {
  it("recorre todas las páginas conservando el filtro estado y tolera un estado nuevo", async () => {
    const { http, fetchMock } = crearHttpDePrueba((url) => {
      const page = Number(new URL(url).searchParams.get("page"));
      return respuestaJson({
        data: [{ ...EVENTO, id: 100 + page, estado: page === 1 ? "agotado" : "estado_nuevo" }],
        pagination: { page, limit: 1, total: 2, totalPages: 2 },
      });
    });

    const items = await recolectar(
      crearFacadeWebhooksFallidos(http).iterar({ estado: "agotado", limit: 1 }),
    );

    expect(items.map((i) => [i.id, i.estado])).toEqual([
      [101, "agotado"],
      [102, "estado_nuevo"],
    ]);
    expect(urlDe(fetchMock)).toBe(
      `${BASE_URL_PRUEBA}/v1/me/webhooks/failed?page=1&limit=1&estado=agotado`,
    );
  });
});
