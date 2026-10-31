import { recolectar } from "../../helpers/iteradores.js";
import { describe, expect, it } from "vitest";
import { respuestaError, respuestaJson, respuestaJsonData } from "../../helpers/mock-fetch.js";
import { crearAdminPrueba, esperarHeadersS2S, peticion } from "../../helpers/ayudas-s2s.js";

const LOG = {
  id: 1201,
  apiKeyId: "clxyz1234567890abcdef",
  ip: "203.0.113.45",
  endpoint: "/v1/send/text",
  method: "POST",
  timestamp: "2026-05-18T12:00:00.000Z",
};

describe("admin.auditoria", () => {
  it("listarLogs manda los filtros en query y entrega { data, pagination } completo", async () => {
    const respuesta = {
      data: [LOG],
      pagination: { page: 2, limit: 10, total: 11, totalPages: 2 },
    };
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJson(respuesta));

    const r = await admin.auditoria.listarLogs({
      apiKeyId: "clxyz1234567890abcdef",
      from: "2026-01-01T00:00:00Z",
      to: "2026-12-31T23:59:59Z",
      page: 2,
      limit: 10,
    });

    expect(r).toEqual({ success: true, data: respuesta });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("GET");
    expect(enviada.ruta).toBe("/v1/admin/audit/logs");
    expect(enviada.query).toEqual({
      apiKeyId: "clxyz1234567890abcdef",
      from: "2026-01-01T00:00:00Z",
      to: "2026-12-31T23:59:59Z",
      page: "2",
      limit: "10",
    });
    esperarHeadersS2S(enviada.headers);
  });

  it("listarLogs sin filtros no manda query", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() =>
      respuestaJson({ data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } }),
    );

    await admin.auditoria.listarLogs();

    expect(peticion(fetchMock).query).toEqual({});
  });

  it("listarLogs rechaza limit > 100 sin enviar la request", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJson({}));

    const r = await admin.auditoria.listarLogs({ limit: 101 });

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("obtenerUso manda apiKeyId y period y desenvuelve el resumen", async () => {
    const resumen = {
      period: "7d",
      totalRequests: 340,
      requestsByEndpoint: { "/v1/send/text": 300, "/v1/session/status": 40 },
      requestsByMethod: { POST: 300, GET: 40 },
      uniqueIps: 2,
      topIps: [{ ip: "203.0.113.45", requestCount: 320, lastSeen: "2026-05-18T12:00:00.000Z" }],
      lastActivity: "2026-05-18T12:00:00.000Z",
    };
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(resumen));

    const r = await admin.auditoria.obtenerUso({ apiKeyId: "clxyz1234567890abcdef", period: "7d" });

    expect(r).toEqual({ success: true, data: resumen });
    const enviada = peticion(fetchMock);
    expect(enviada.ruta).toBe("/v1/admin/audit/analytics/usage");
    expect(enviada.query).toEqual({ apiKeyId: "clxyz1234567890abcdef", period: "7d" });
    esperarHeadersS2S(enviada.headers);
  });

  it("obtenerUso mapea el 400 de periodo inválido de la API", async () => {
    const { admin } = crearAdminPrueba(() => respuestaError(400, "Periodo invalido"));

    const r = await admin.auditoria.obtenerUso({ apiKeyId: "clxyz1234567890abcdef" });

    expect(r).toMatchObject({ success: false, codigo: 400, error: "Periodo invalido" });
  });

  it("obtenerUso con una respuesta de forma inesperada devuelve 502", async () => {
    const { admin } = crearAdminPrueba(() => respuestaJsonData({ period: "24h" }));

    const r = await admin.auditoria.obtenerUso({ apiKeyId: "clxyz1234567890abcdef" });

    expect(r).toMatchObject({ success: false, codigo: 502 });
  });
});

describe("admin.auditoria.iterarLogs", () => {
  it("recorre todas las páginas y conserva los filtros", async () => {
    const { admin, fetchMock } = crearAdminPrueba((url) => {
      const page = Number(new URL(url).searchParams.get("page"));
      return respuestaJson({
        data: [{ ...LOG, id: 100 + page }],
        pagination: { page, limit: 1, total: 2, totalPages: 2 },
      });
    });

    const items = await recolectar(admin.auditoria.iterarLogs({ apiKeyId: "k1", limit: 1 }));

    expect(items.map((l) => l.id)).toEqual([101, 102]);
    expect(peticion(fetchMock, 1).query).toEqual({ apiKeyId: "k1", limit: "1", page: "2" });
  });
});

describe("admin: opciones de operación como segundo argumento", () => {
  it("la signal de opciones llega al fetch en una operación con input", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() =>
      respuestaJson({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
    );
    const control = new AbortController();
    control.abort();

    await admin.auditoria.listarLogs({}, { signal: control.signal });

    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("la signal de opciones llega al fetch en una operación sin input", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData([]));
    const control = new AbortController();
    control.abort();

    await admin.billing.precios.listar({ signal: control.signal });

    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("sin opciones la signal no está abortada", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData([]));

    await admin.billing.precios.listar();

    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(false);
  });
});
