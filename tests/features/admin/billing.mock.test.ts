import { recolectar } from "../../helpers/iteradores.js";
import { describe, expect, it } from "vitest";
import { respuestaError, respuestaJson, respuestaJsonData } from "../../helpers/mock-fetch.js";
import { crearAdminPrueba, esperarBearer, peticion } from "../../helpers/ayudas-token.js";

const PRECIO = {
  id: 3,
  moneda: "USD",
  costoPorMensaje: "0.0025",
  activa: true,
  createdAt: "2026-05-01T10:00:00.000Z",
  updatedAt: "2026-05-02T10:00:00.000Z",
};

describe("admin.billing.precios", () => {
  it("listar hace GET /billing/precios y desenvuelve el array", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData([PRECIO]));

    const r = await admin.billing.precios.listar();

    expect(r).toEqual({ success: true, data: [PRECIO] });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("GET");
    expect(enviada.ruta).toBe("/v1/admin/billing/precios");
    esperarBearer(enviada.headers);
  });

  it("crear hace POST con { moneda, costoPorMensaje } y desenvuelve el 201", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(PRECIO, { status: 201 }));

    const r = await admin.billing.precios.crear({ moneda: "USD", costoPorMensaje: "0.0025" });

    expect(r).toEqual({ success: true, data: PRECIO });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("POST");
    expect(enviada.ruta).toBe("/v1/admin/billing/precios");
    expect(enviada.cuerpo).toEqual({ moneda: "USD", costoPorMensaje: "0.0025" });
    esperarBearer(enviada.headers);
  });

  it("crear mapea el 409 de moneda duplicada", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaError(409, "Ya existe un precio para la moneda USD"),
    );

    const r = await admin.billing.precios.crear({ moneda: "USD", costoPorMensaje: "0.0025" });

    expect(r).toMatchObject({
      success: false,
      codigo: 409,
      error: "Ya existe un precio para la moneda USD",
    });
  });

  it("crear rechaza una moneda no soportada sin enviar la request", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(PRECIO));

    // @ts-expect-error "XXX" no es una moneda soportada
    const r = await admin.billing.precios.crear({ moneda: "XXX", costoPorMensaje: "1" });

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("actualizar hace PUT /precios/{moneda} con el body sin la moneda", async () => {
    const actualizado = { ...PRECIO, costoPorMensaje: "0.0030", activa: false };
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(actualizado));

    const r = await admin.billing.precios.actualizar({
      moneda: "USD",
      costoPorMensaje: "0.0030",
      activa: false,
    });

    expect(r).toEqual({ success: true, data: actualizado });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("PUT");
    expect(enviada.ruta).toBe("/v1/admin/billing/precios/USD");
    expect(enviada.cuerpo).toEqual({ costoPorMensaje: "0.0030", activa: false });
    esperarBearer(enviada.headers);
  });

  it("actualizar mapea el 404 de moneda sin precio", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaError(404, "Precio no encontrado para la moneda ARS"),
    );

    const r = await admin.billing.precios.actualizar({ moneda: "ARS", activa: true });

    expect(r).toMatchObject({ success: false, codigo: 404 });
  });

  it("desactivar hace DELETE /precios/{moneda} y desenvuelve { message }", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() =>
      respuestaJsonData({ message: "Moneda ARS desactivada" }),
    );

    const r = await admin.billing.precios.desactivar({ moneda: "ARS" });

    expect(r).toEqual({ success: true, data: { message: "Moneda ARS desactivada" } });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("DELETE");
    expect(enviada.ruta).toBe("/v1/admin/billing/precios/ARS");
    esperarBearer(enviada.headers);
  });
});

describe("admin.billing.ajustarSaldo", () => {
  it("hace POST /users/{id}/ajuste con tipo ajuste_manual fijo y desenvuelve { balance }", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData({ balance: "125.0000" }));

    const r = await admin.billing.ajustarSaldo({
      userId: "cluser0001abc",
      monto: "-25.0000",
      moneda: "USD",
      descripcion: "Refund por baja de cuenta solicitada por el usuario",
      forzar: true,
    });

    expect(r).toEqual({ success: true, data: { balance: "125.0000" } });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("POST");
    expect(enviada.ruta).toBe("/v1/admin/billing/users/cluser0001abc/ajuste");
    expect(enviada.cuerpo).toEqual({
      tipo: "ajuste_manual",
      monto: "-25.0000",
      moneda: "USD",
      descripcion: "Refund por baja de cuenta solicitada por el usuario",
      forzar: true,
    });
    esperarBearer(enviada.headers);
  });

  it("mapea el 422 de monto sobre el cap admin sin forzar", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaError(422, "Monto excede el cap admin (1000). Use forzar: true para anular."),
    );

    const r = await admin.billing.ajustarSaldo({
      userId: "cluser0001abc",
      monto: "99999.0000",
      moneda: "USD",
      descripcion: "Ajuste grande de prueba para el cap",
    });

    expect(r).toMatchObject({ success: false, codigo: 422 });
  });

  it("rechaza una descripción corta sin enviar la request", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData({}));

    const r = await admin.billing.ajustarSaldo({
      userId: "cluser0001abc",
      monto: "10.0000",
      moneda: "USD",
      descripcion: "corta",
    });

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(r.success === false && r.error).toContain("descripcion");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("admin.billing.cambiarMoneda", () => {
  const CAMBIO = {
    balanceAnterior: "100.0000",
    monedaAnterior: "USD",
    balanceNuevo: "100000.0000",
    costoPorMensajeAnterior: "0.0025",
    costoPorMensajeNuevo: "2.5000",
    monedaNueva: "COP",
    movimientoId: 88,
  };

  it("hace PUT /api-key/{phone}/moneda y desenvuelve el resultado de la conversión", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(CAMBIO));

    const r = await admin.billing.cambiarMoneda({
      phone: "5491155553333",
      monedaActual: "USD",
      nuevaMoneda: "COP",
      tasaConversion: 1000,
    });

    expect(r).toEqual({ success: true, data: CAMBIO });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("PUT");
    expect(enviada.ruta).toBe("/v1/admin/billing/api-key/5491155553333/moneda");
    expect(enviada.cuerpo).toEqual({
      monedaActual: "USD",
      nuevaMoneda: "COP",
      tasaConversion: 1000,
    });
    esperarBearer(enviada.headers);
  });

  it("mapea el 409 de moneda actual desfasada o pagos pendientes", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaError(409, "La moneda actual del usuario no coincide"),
    );

    const r = await admin.billing.cambiarMoneda({
      phone: "5491155553333",
      monedaActual: "USD",
      nuevaMoneda: "COP",
      tasaConversion: 1000,
    });

    expect(r).toMatchObject({ success: false, codigo: 409 });
  });
});

describe("admin.billing.configurar", () => {
  it("hace PUT /api-key/{phone}/config y entrega message más los campos echo-eados", async () => {
    const respuesta = {
      message: "Configuracion de billing actualizada",
      costoPorMensaje: "0.0030",
      recibirEntrantes: false,
    };
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(respuesta));

    const r = await admin.billing.configurar({
      phone: "5491155553333",
      costoPorMensaje: "0.0030",
      recibirEntrantes: false,
    });

    expect(r).toEqual({ success: true, data: respuesta });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("PUT");
    expect(enviada.ruta).toBe("/v1/admin/billing/api-key/5491155553333/config");
    expect(enviada.cuerpo).toEqual({ costoPorMensaje: "0.0030", recibirEntrantes: false });
    esperarBearer(enviada.headers);
  });

  it("mapea el 400 de config vacía", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaError(400, "Debe especificar al menos un campo a actualizar"),
    );

    const r = await admin.billing.configurar({ phone: "5491155553333" });

    expect(r).toMatchObject({
      success: false,
      codigo: 400,
      error: "Debe especificar al menos un campo a actualizar",
    });
  });
});

describe("admin.billing.listarMovimientos", () => {
  it("hace GET /api-key/{phone}/movimientos con query y entrega { data, pagination }", async () => {
    const respuesta = {
      data: [
        {
          id: 501,
          tipo: "recarga",
          monto: "50.0000",
          moneda: "USD",
          balanceAnterior: "0.0000",
          balanceNuevo: "50.0000",
          descripcion: null,
          referencia: "pago:clxyz123abc",
          createdAt: "2026-05-18T12:00:00.000Z",
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJson(respuesta));

    const r = await admin.billing.listarMovimientos({
      phone: "5491155553333",
      page: 1,
      limit: 20,
      tipo: "recarga",
    });

    expect(r).toEqual({ success: true, data: respuesta });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("GET");
    expect(enviada.ruta).toBe("/v1/admin/billing/api-key/5491155553333/movimientos");
    expect(enviada.query).toEqual({ page: "1", limit: "20", tipo: "recarga" });
    esperarBearer(enviada.headers);
  });

  it("mapea el 404 de API key inexistente", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaError(404, "API key no encontrada para ese telefono"),
    );

    const r = await admin.billing.listarMovimientos({ phone: "5491155553333" });

    expect(r).toMatchObject({ success: false, codigo: 404 });
  });
});

describe("admin.billing.iterarMovimientos", () => {
  it("recorre todas las páginas de los movimientos de la API key", async () => {
    const { admin, fetchMock } = crearAdminPrueba((url) => {
      const page = Number(new URL(url).searchParams.get("page"));
      return respuestaJson({
        data: [
          {
            id: 100 + page,
            tipo: "recarga",
            monto: "1",
            moneda: "USD",
            balanceAnterior: "0",
            balanceNuevo: "1",
            descripcion: null,
            referencia: null,
            createdAt: "2026-05-18T12:00:00.000Z",
          },
        ],
        pagination: { page, limit: 1, total: 2, totalPages: 2 },
      });
    });

    const items = await recolectar(
      admin.billing.iterarMovimientos({ phone: "5491155553333", limit: 1 }),
    );

    expect(items.map((m) => m.id)).toEqual([101, 102]);
    expect(peticion(fetchMock, 1).ruta).toBe("/v1/admin/billing/api-key/5491155553333/movimientos");
    expect(peticion(fetchMock, 1).query).toEqual({ limit: "1", page: "2" });
  });
});
