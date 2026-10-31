import { recolectar } from "../../helpers/iteradores.js";
import { describe, expect, it } from "vitest";
import { crearFacadeBufferWs } from "../../../src/features/buffer-ws/index.js";
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

/** Forma real de `wsEventoPendienteSchema` de la API. */
const EVENTO = {
  id: 5,
  phone: "593999999999",
  tipoEvento: "billing_alert",
  payload: '{"type":"billing_alert"}',
  createdAt: "2026-03-22T10:00:00.000Z",
} as const;

describe("bufferWs.listar", () => {
  const LISTA = {
    data: [EVENTO],
    pagination: { page: 3, limit: 50, total: 101, totalPages: 3 },
  };

  it("hace GET a /v1/me/ws/pending con page y limit y devuelve data + pagination", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJson(LISTA));

    const r = await crearFacadeBufferWs(http).listar({ page: 3, limit: 50 });

    expect(r).toEqual({ success: true, data: LISTA });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/ws/pending?page=3&limit=50`);
    expect(initDe(fetchMock).method).toBe("GET");
  });

  it("rechaza page 0 sin llamar a la red", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJson(LISTA));

    const r = await crearFacadeBufferWs(http).listar({ page: 0 });

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mapea el 401", async () => {
    const { http } = crearHttpDePrueba(() => respuestaError(401, "API key inválida"));

    const r = await crearFacadeBufferWs(http).listar();

    expect(r).toMatchObject({ success: false, codigo: 401 });
  });
});

describe("bufferWs.contar", () => {
  it("hace GET a /v1/me/ws/pending/count y devuelve { count }", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({ count: 42 }));

    const r = await crearFacadeBufferWs(http).contar();

    expect(r).toEqual({ success: true, data: { count: 42 } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/ws/pending/count`);
    expect(initDe(fetchMock).method).toBe("GET");
  });

  it("devuelve parseo fallido si count no es número", async () => {
    const { http } = crearHttpDePrueba(() => respuestaJsonData({ count: "42" }));

    const r = await crearFacadeBufferWs(http).contar();

    expect(r).toMatchObject({ success: false });
  });
});

describe("bufferWs.eliminarTodos", () => {
  it("hace DELETE a /v1/me/ws/pending y devuelve { message }", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() =>
      respuestaJsonData({ message: "4 eventos pendientes eliminados" }),
    );

    const r = await crearFacadeBufferWs(http).eliminarTodos();

    expect(r).toEqual({ success: true, data: { message: "4 eventos pendientes eliminados" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/ws/pending`);
    expect(initDe(fetchMock).method).toBe("DELETE");
  });

  it("mapea el 429", async () => {
    const { http } = crearHttpDePrueba(() => respuestaError(429, "Demasiadas solicitudes"));

    const r = await crearFacadeBufferWs(http).eliminarTodos();

    expect(r).toMatchObject({ success: false, codigo: 429 });
  });
});

describe("bufferWs.eliminar", () => {
  it("hace DELETE a /v1/me/ws/pending/{id}", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() =>
      respuestaJsonData({ message: "Evento pendiente eliminado" }),
    );

    const r = await crearFacadeBufferWs(http).eliminar(5);

    expect(r).toEqual({ success: true, data: { message: "Evento pendiente eliminado" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/ws/pending/5`);
    expect(initDe(fetchMock).method).toBe("DELETE");
  });

  it("mapea el 404", async () => {
    const { http } = crearHttpDePrueba(() => respuestaError(404, "Evento no encontrado"));

    const r = await crearFacadeBufferWs(http).eliminar(5);

    expect(r).toMatchObject({ success: false, codigo: 404, error: "Evento no encontrado" });
  });
});

describe("bufferWs.iterar", () => {
  it("recorre todas las páginas pidiendo page=1,2 y cede los items en orden", async () => {
    const { http, fetchMock } = crearHttpDePrueba((url) => {
      const page = Number(new URL(url).searchParams.get("page"));
      return respuestaJson({
        data: [{ ...EVENTO, id: 100 + page }],
        pagination: { page, limit: 1, total: 2, totalPages: 2 },
      });
    });

    const items = await recolectar(crearFacadeBufferWs(http).iterar({ limit: 1 }));

    expect(items.map((i) => i.id)).toEqual([101, 102]);
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/ws/pending?page=1&limit=1`);
  });
});
