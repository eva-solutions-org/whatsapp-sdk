import { recolectar } from "../../helpers/iteradores.js";
import { describe, expect, it } from "vitest";
import { crearFacadeBilling } from "../../../src/features/billing/index.js";
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

/** Forma real de `balanceBillingResponseSchema.data` (montos como string decimal). */
const BALANCE = {
  balance: "150.0000",
  moneda: "USD",
  costoPorMensaje: "0.0025",
  mensajesGratisRestantes: 80,
  mensajesGratisPorMes: 100,
  faseGracia: { fase: "normal", puedeEnviar: true, puedeRecibir: true, horasEnGracia: null },
  umbralSaldoBajo: "5.0000",
  saldoBajo: false,
} as const;

describe("billing.obtenerBalance", () => {
  it("hace GET a /v1/me/billing/balance y devuelve el balance", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData(BALANCE));

    const r = await crearFacadeBilling(http).obtenerBalance();

    expect(r).toEqual({ success: true, data: BALANCE });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/billing/balance`);
    expect(initDe(fetchMock).method).toBe("GET");
  });

  it("mapea el 404 de usuario no encontrado", async () => {
    const { http } = crearHttpDePrueba(() => respuestaError(404, "Usuario no encontrado"));

    const r = await crearFacadeBilling(http).obtenerBalance();

    expect(r).toMatchObject({ success: false, codigo: 404, error: "Usuario no encontrado" });
  });

  it("tolera una fase de gracia nueva (forward-compat) sin romper la respuesta", async () => {
    const { http } = crearHttpDePrueba(() =>
      respuestaJsonData({ ...BALANCE, faseGracia: { ...BALANCE.faseGracia, fase: "fase_9" } }),
    );

    const r = await crearFacadeBilling(http).obtenerBalance();

    expect(r).toMatchObject({ success: true, data: { faseGracia: { fase: "fase_9" } } });
  });
});

describe("billing.listarMovimientos", () => {
  /** `apiKeyId` viaja en la respuesta real aunque el OpenAPI no lo declare. */
  const MOVIMIENTO = {
    id: 3,
    tipo: "cobro_saliente",
    monto: "0.0025",
    moneda: "USD",
    balanceAnterior: "150.0025",
    balanceNuevo: "150.0000",
    descripcion: "Envio a +5491155553333",
    referencia: null,
    apiKeyId: "clxyz123abc",
    createdAt: "2026-03-22T10:00:00.000Z",
  } as const;
  const LISTA = {
    data: [MOVIMIENTO],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  it("manda page, limit y tipo en el query y devuelve data + pagination", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJson(LISTA));

    const r = await crearFacadeBilling(http).listarMovimientos({
      page: 1,
      limit: 20,
      tipo: "cobro_saliente",
    });

    expect(r).toEqual({ success: true, data: LISTA });
    expect(urlDe(fetchMock)).toBe(
      `${BASE_URL_PRUEBA}/v1/me/billing/movimientos?page=1&limit=20&tipo=cobro_saliente`,
    );
  });

  it("rechaza un tipo desconocido sin llamar a la red", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJson(LISTA));

    const r = await crearFacadeBilling(http).listarMovimientos({ tipo: "regalo" as never });

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mapea el 500", async () => {
    const { http } = crearHttpDePrueba(() =>
      respuestaError(500, "Error al listar los movimientos"),
    );

    const r = await crearFacadeBilling(http).listarMovimientos();

    expect(r).toMatchObject({ success: false, codigo: 500 });
  });
});

describe("billing.crearRecarga", () => {
  const RECARGA = {
    pagoId: "clpago123",
    monto: "50.00",
    moneda: "USD",
    estado: "procesando",
    paymentLink: "https://pagos.example.com/checkout/clpago123",
    qrCodeUrl: null,
    expiresAt: "2026-03-23T10:00:00.000Z",
  } as const;

  it("hace POST JSON a /v1/me/billing/recarga y devuelve la recarga (201)", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() =>
      respuestaJsonData(RECARGA, { status: 201 }),
    );

    const r = await crearFacadeBilling(http).crearRecarga({ monto: "50.00" });

    expect(r).toEqual({ success: true, data: RECARGA });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/billing/recarga`);
    expect(initDe(fetchMock).method).toBe("POST");
    expect(initDe(fetchMock).body).toBe('{"monto":"50.00"}');
  });

  it("rechaza un monto con ceros a la izquierda sin llamar a la red", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData(RECARGA));

    const r = await crearFacadeBilling(http).crearRecarga({ monto: "01.00" });

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza un monto con más de 8 enteros o sin 2 decimales sin llamar a la red", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData(RECARGA));
    const facade = crearFacadeBilling(http);

    const nueveEnteros = await facade.crearRecarga({ monto: "123456789.00" });
    const unDecimal = await facade.crearRecarga({ monto: "50.0" });

    expect(nueveEnteros).toMatchObject({ success: false, codigo: 422 });
    expect(unDecimal).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("acepta el máximo de 8 enteros", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData(RECARGA));

    await crearFacadeBilling(http).crearRecarga({ monto: "12345678.99" });

    expect(initDe(fetchMock).body).toBe('{"monto":"12345678.99"}');
  });

  it("mapea el 503 de pagos no disponible", async () => {
    const { http } = crearHttpDePrueba(() =>
      respuestaError(503, "Servicio de pagos no disponible"),
    );

    const r = await crearFacadeBilling(http).crearRecarga({ monto: "50.00" });

    expect(r).toMatchObject({
      success: false,
      codigo: 503,
      error: "Servicio de pagos no disponible",
    });
  });
});

describe("billing.obtenerRecarga", () => {
  it("hace GET a /v1/me/billing/recarga/{id}; sin link/QR los opcionales quedan ausentes", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() =>
      respuestaJsonData({
        pagoId: "clpago123",
        monto: "50.0000",
        moneda: "USD",
        estado: "completado",
      }),
    );

    const r = await crearFacadeBilling(http).obtenerRecarga("clpago123");

    expect(r).toEqual({
      success: true,
      data: { pagoId: "clpago123", monto: "50.0000", moneda: "USD", estado: "completado" },
    });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/billing/recarga/clpago123`);
  });

  it("codifica el id como un único segmento de path", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() =>
      respuestaError(404, "Recarga no encontrada"),
    );

    await crearFacadeBilling(http).obtenerRecarga("a/b?x");

    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/billing/recarga/a%2Fb%3Fx`);
  });

  it("mapea el 404", async () => {
    const { http } = crearHttpDePrueba(() => respuestaError(404, "Recarga no encontrada"));

    const r = await crearFacadeBilling(http).obtenerRecarga("nope");

    expect(r).toMatchObject({ success: false, codigo: 404, error: "Recarga no encontrada" });
  });
});

describe("billing.actualizarConfiguracion", () => {
  it("hace PUT JSON a /v1/me/billing/configuracion y devuelve message + umbral", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() =>
      respuestaJsonData({
        message: "Configuracion de billing actualizada",
        umbralSaldoBajo: "10.0000",
      }),
    );

    const r = await crearFacadeBilling(http).actualizarConfiguracion({
      umbralSaldoBajo: "10.0000",
    });

    expect(r).toEqual({
      success: true,
      data: { message: "Configuracion de billing actualizada", umbralSaldoBajo: "10.0000" },
    });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/billing/configuracion`);
    expect(initDe(fetchMock).method).toBe("PUT");
    expect(initDe(fetchMock).body).toBe('{"umbralSaldoBajo":"10.0000"}');
  });

  it("rechaza un umbral no decimal sin llamar a la red", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({ message: "x" }));

    const r = await crearFacadeBilling(http).actualizarConfiguracion({ umbralSaldoBajo: "diez" });

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mapea el 400 de la API", async () => {
    const { http } = crearHttpDePrueba(() =>
      respuestaError(400, "Debe especificar al menos un campo a actualizar"),
    );

    const r = await crearFacadeBilling(http).actualizarConfiguracion({ umbralSaldoBajo: "1" });

    expect(r).toMatchObject({ success: false, codigo: 400 });
  });
});

describe("billing.iterarMovimientos", () => {
  it("recorre todas las páginas y tolera un tipo de movimiento nuevo", async () => {
    const { http, fetchMock } = crearHttpDePrueba((url) => {
      const page = Number(new URL(url).searchParams.get("page"));
      return respuestaJson({
        data: [
          {
            id: 100 + page,
            tipo: page === 1 ? "cobro_saliente" : "tipo_nuevo",
            monto: "1",
            moneda: "USD",
            balanceAnterior: "2",
            balanceNuevo: "1",
            descripcion: null,
            referencia: null,
            createdAt: "2026-03-22T10:00:00.000Z",
          },
        ],
        pagination: { page, limit: 1, total: 2, totalPages: 2 },
      });
    });

    const items = await recolectar(crearFacadeBilling(http).iterarMovimientos({ limit: 1 }));

    expect(items.map((i) => [i.id, i.tipo])).toEqual([
      [101, "cobro_saliente"],
      [102, "tipo_nuevo"],
    ]);
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/me/billing/movimientos?page=1&limit=1`);
  });
});
