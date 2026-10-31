import { recolectar } from "../../helpers/iteradores.js";
import { describe, expect, it } from "vitest";
import { respuestaError, respuestaJson, respuestaJsonData } from "../../helpers/mock-fetch.js";
import { crearAdminPrueba, esperarBearer, peticion } from "../../helpers/ayudas-token.js";

describe("admin.pagos", () => {
  it("obtener hace GET /pagos/{id} y entrega { local, pasarela }", async () => {
    const data = {
      local: { id: "clxyz123abc", estado: "pendiente", montoOriginal: "4.0000" },
      pasarela: { estado: "pendiente" },
    };
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(data));

    const r = await admin.pagos.obtener({ id: "clxyz123abc" });

    expect(r).toEqual({ success: true, data });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("GET");
    expect(enviada.ruta).toBe("/v1/admin/billing/pagos/clxyz123abc");
    esperarBearer(enviada.headers);
  });

  it("obtener acepta pasarela null (pago sin id externo)", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaJsonData({ local: { id: "clxyz123abc" }, pasarela: null }),
    );

    const r = await admin.pagos.obtener({ id: "clxyz123abc" });

    expect(r).toEqual({
      success: true,
      data: { local: { id: "clxyz123abc" }, pasarela: null },
    });
  });

  it("obtener mapea el 503 de pagos deshabilitados", async () => {
    const { admin } = crearAdminPrueba(() => respuestaError(503, "Pagos deshabilitado"));

    const r = await admin.pagos.obtener({ id: "clxyz123abc" });

    expect(r).toMatchObject({ success: false, codigo: 503, error: "Pagos deshabilitado" });
  });

  it("cancelar hace POST /pagos/{id}/cancelar sin body", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() =>
      respuestaJsonData({ id: "clxyz123abc", pasarelaStatus: "cancelando" }),
    );

    const r = await admin.pagos.cancelar({ id: "clxyz123abc" });

    expect(r).toEqual({
      success: true,
      data: { id: "clxyz123abc", pasarelaStatus: "cancelando" },
    });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("POST");
    expect(enviada.ruta).toBe("/v1/admin/billing/pagos/clxyz123abc/cancelar");
    expect(enviada.cuerpo).toBeUndefined();
    esperarBearer(enviada.headers);
  });

  it("cancelar mapea el 409 de estado terminal", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaError(409, "No se puede cancelar un pago en estado completado"),
    );

    const r = await admin.pagos.cancelar({ id: "clxyz123abc" });

    expect(r).toMatchObject({ success: false, codigo: 409 });
  });

  it("reembolsar con monto manda { monto } en POST /pagos/{id}/refund", async () => {
    const data = { id: "clxyz123abc", pasarelaStatus: "reembolsando", estadoSdk: "reembolsando" };
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(data));

    const r = await admin.pagos.reembolsar({ id: "clxyz123abc", monto: "4.00" });

    expect(r).toEqual({ success: true, data });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("POST");
    expect(enviada.ruta).toBe("/v1/admin/billing/pagos/clxyz123abc/refund");
    expect(enviada.cuerpo).toEqual({ monto: "4.00" });
    esperarBearer(enviada.headers);
  });

  it("reembolsar total manda body vacío {}", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() =>
      respuestaJsonData({ id: "clxyz123abc", pasarelaStatus: "reembolsando", estadoSdk: "x" }),
    );

    await admin.pagos.reembolsar({ id: "clxyz123abc" });

    expect(peticion(fetchMock).cuerpo).toEqual({});
  });

  it("reembolsar rechaza un monto sin 2 decimales sin enviar la request", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData({}));

    const r = await admin.pagos.reembolsar({ id: "clxyz123abc", monto: "4.5" });

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

const EXENCION = {
  id: 42,
  exempt: true,
  expiresAt: "2026-12-31T23:59:59.000Z",
  reason: "Beta tester oficial del programa de acceso anticipado",
  ip: "203.0.113.45",
  createdAt: "2026-05-18T12:00:00.000Z",
};

describe("admin.exencionPago", () => {
  it("alternar hace PATCH /users/{id}/payment-exemption y desenvuelve { userId, exencion }", async () => {
    const data = { userId: "cluser0001abc", exencion: EXENCION };
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(data));

    const r = await admin.exencionPago.alternar({
      userId: "cluser0001abc",
      exempt: true,
      reason: "Beta tester oficial del programa de acceso anticipado",
      expiresAt: "2026-12-31T23:59:59.000Z",
    });

    expect(r).toEqual({ success: true, data });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("PATCH");
    expect(enviada.ruta).toBe("/v1/admin/billing/users/cluser0001abc/payment-exemption");
    expect(enviada.cuerpo).toEqual({
      exempt: true,
      reason: "Beta tester oficial del programa de acceso anticipado",
      expiresAt: "2026-12-31T23:59:59.000Z",
    });
    esperarBearer(enviada.headers);
  });

  it("alternar mapea el 422 de vencimiento en el pasado", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaError(422, "expiresAt debe ser una fecha futura"),
    );

    const r = await admin.exencionPago.alternar({
      userId: "cluser0001abc",
      exempt: true,
      reason: "Motivo con más de diez caracteres",
      expiresAt: "2020-01-01T00:00:00.000Z",
    });

    expect(r).toMatchObject({ success: false, codigo: 422 });
  });

  it("historial hace GET .../history con query (booleanos como true/false) y entrega { items, pagination }", async () => {
    const respuesta = {
      items: [{ ...EXENCION, userId: "cluser0001abc" }],
      pagination: { nextCursor: "eyJjcmVhdGVkQXQiOiIyMDI2In0=", hasMore: true, limit: 20 },
    };
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJson(respuesta));

    const r = await admin.exencionPago.historial({
      userId: "cluser0001abc",
      limit: 20,
      cursor: "abc",
      desde: "2026-01-01T00:00:00.000Z",
      hasta: "2026-12-31T23:59:59.000Z",
      exempt: false,
      soloVigente: false,
    });

    expect(r).toEqual({ success: true, data: respuesta });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("GET");
    expect(enviada.ruta).toBe("/v1/admin/billing/users/cluser0001abc/payment-exemption/history");
    expect(enviada.query).toEqual({
      limit: "20",
      cursor: "abc",
      desde: "2026-01-01T00:00:00.000Z",
      hasta: "2026-12-31T23:59:59.000Z",
      exempt: "false",
      soloVigente: "false",
    });
    esperarBearer(enviada.headers);
  });

  it("historial mapea el 400 de cursor inválido", async () => {
    const { admin } = crearAdminPrueba(() => respuestaError(400, "Cursor invalido o expirado"));

    const r = await admin.exencionPago.historial({ userId: "cluser0001abc", cursor: "zzz" });

    expect(r).toMatchObject({ success: false, codigo: 400, error: "Cursor invalido o expirado" });
  });
});

describe("admin.exencionPago.iterarHistorial", () => {
  it("sigue nextCursor mientras hasMore sea true y se detiene en la última página", async () => {
    const { admin, fetchMock } = crearAdminPrueba((url) => {
      const cursor = new URL(url).searchParams.get("cursor");
      return cursor === null
        ? respuestaJson({
            items: [{ ...EXENCION, id: 1, userId: "cluser0001abc" }],
            pagination: { nextCursor: "c2", hasMore: true, limit: 1 },
          })
        : respuestaJson({
            items: [{ ...EXENCION, id: 2, userId: "cluser0001abc" }],
            pagination: { nextCursor: "ignorado-sin-hasMore", hasMore: false, limit: 1 },
          });
    });

    const items = await recolectar(
      admin.exencionPago.iterarHistorial({ userId: "cluser0001abc", limit: 1 }),
    );

    expect(items.map((e) => e.id)).toEqual([1, 2]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(peticion(fetchMock, 1).query).toEqual({ limit: "1", cursor: "c2" });
  });
});
