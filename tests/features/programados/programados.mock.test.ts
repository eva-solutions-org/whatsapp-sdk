import { recolectar } from "../../helpers/iteradores.js";
import { describe, expect, it } from "vitest";
import { crearFacadeProgramados } from "../../../src/features/programados/index.js";
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

/** Forma real de `mensajeProgramadoResponseSchema` de la API. */
const RESUMEN = {
  id: 7,
  destinatario: "5491155553333",
  tipo: "message",
  programadoPara: "2026-03-23T10:00:00.000Z",
  estado: "pendiente",
  createdAt: "2026-03-22T10:00:00.000Z",
} as const;

describe("programados.crear", () => {
  it("hace POST JSON a /v1/me/schedule y desenvuelve el resumen (201)", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() =>
      respuestaJsonData(RESUMEN, { status: 201 }),
    );
    const input = {
      destinatario: "5491155553333",
      tipo: "message",
      payload: { message: "Hola" },
      programadoPara: "2026-03-23T10:00:00.000Z",
    } as const;

    const r = await crearFacadeProgramados(http).crear(input);

    expect(r).toEqual({ success: true, data: RESUMEN });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/schedule`);
    expect(initDe(fetchMock).method).toBe("POST");
    expect(JSON.parse(initDe(fetchMock).body as string)).toEqual(input);
  });

  it("mapea el 400 de fecha menor a 1 minuto en el futuro", async () => {
    const { http } = crearHttpDePrueba(() =>
      respuestaError(400, "La fecha programada debe ser al menos 1 minuto en el futuro"),
    );

    const r = await crearFacadeProgramados(http).crear({
      destinatario: "5491155553333",
      tipo: "message",
      payload: { message: "Hola" },
      programadoPara: "2020-01-01T00:00:00.000Z",
    });

    expect(r).toMatchObject({
      success: false,
      codigo: 400,
      error: "La fecha programada debe ser al menos 1 minuto en el futuro",
    });
  });

  it("rechaza una fecha que no es ISO 8601 sin llamar a la red", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData(RESUMEN));

    const r = await crearFacadeProgramados(http).crear({
      destinatario: "5491155553333",
      tipo: "message",
      payload: {},
      programadoPara: "mañana",
    });

    expect(r).toMatchObject({
      success: false,
      codigo: 422,
      detalles: { fieldErrors: { programadoPara: expect.any(Array) } },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("programados.listar", () => {
  const LISTA = {
    data: [RESUMEN],
    pagination: { page: 2, limit: 10, total: 11, totalPages: 2 },
  };

  it("manda page y limit en el query y devuelve data + pagination", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJson(LISTA));

    const r = await crearFacadeProgramados(http).listar({ page: 2, limit: 10 });

    expect(r).toEqual({ success: true, data: LISTA });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/schedule?page=2&limit=10`);
    expect(initDe(fetchMock).method).toBe("GET");
  });

  it("sin filtros no manda query", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJson(LISTA));

    await crearFacadeProgramados(http).listar();

    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/schedule`);
  });

  it("rechaza limit > 100 sin llamar a la red", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJson(LISTA));

    const r = await crearFacadeProgramados(http).listar({ limit: 101 });

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mapea el 401", async () => {
    const { http } = crearHttpDePrueba(() => respuestaError(401, "API key inválida"));

    const r = await crearFacadeProgramados(http).listar();

    expect(r).toMatchObject({ success: false, codigo: 401 });
  });
});

describe("programados.obtener", () => {
  const DETALLE = {
    ...RESUMEN,
    estado: "fallido",
    payload: { message: "Hola" },
    mensajeError: "Sesión no disponible",
    intentos: 3,
    maxIntentos: 3,
  };

  it("hace GET a /v1/me/schedule/{id} y devuelve el detalle", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData(DETALLE));

    const r = await crearFacadeProgramados(http).obtener(7);

    expect(r).toEqual({ success: true, data: DETALLE });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/schedule/7`);
  });

  it("mapea el 404", async () => {
    const { http } = crearHttpDePrueba(() =>
      respuestaError(404, "Mensaje programado no encontrado"),
    );

    const r = await crearFacadeProgramados(http).obtener(99);

    expect(r).toMatchObject({
      success: false,
      codigo: 404,
      error: "Mensaje programado no encontrado",
    });
  });

  it("rechaza un id no entero sin llamar a la red", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData(DETALLE));

    const r = await crearFacadeProgramados(http).obtener(1.5);

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("programados.cancelar", () => {
  it("hace DELETE a /v1/me/schedule/{id} y devuelve { message }", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() =>
      respuestaJsonData({ message: "Mensaje programado cancelado" }),
    );

    const r = await crearFacadeProgramados(http).cancelar(7);

    expect(r).toEqual({ success: true, data: { message: "Mensaje programado cancelado" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/schedule/7`);
    expect(initDe(fetchMock).method).toBe("DELETE");
  });

  it("mapea el 404 de un mensaje que ya no se puede cancelar", async () => {
    const { http } = crearHttpDePrueba(() =>
      respuestaError(404, "Mensaje programado no encontrado o no se puede cancelar"),
    );

    const r = await crearFacadeProgramados(http).cancelar(7);

    expect(r).toMatchObject({ success: false, codigo: 404 });
  });
});

describe("programados.iterar", () => {
  it("recorre todas las páginas pidiendo page=1,2 y cede los items en orden", async () => {
    const { http, fetchMock } = crearHttpDePrueba((url) => {
      const page = Number(new URL(url).searchParams.get("page"));
      return respuestaJson({
        data: [{ ...RESUMEN, id: 100 + page }],
        pagination: { page, limit: 1, total: 2, totalPages: 2 },
      });
    });

    const items = await recolectar(crearFacadeProgramados(http).iterar({ limit: 1 }));

    expect(items.map((i) => i.id)).toEqual([101, 102]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/schedule?page=1&limit=1`);
  });
});
