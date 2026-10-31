import { describe, expect, it } from "vitest";
import {
  respuestaError,
  respuestaErrorToken,
  respuestaJsonData,
} from "../../helpers/mock-fetch.js";
import { crearAdminPrueba, esperarBearer, peticion } from "../../helpers/ayudas-token.js";
import { crearFacadeQrSistema } from "../../../src/features/admin-qr-sistema/index.js";
import { crearHttpDePrueba } from "../../helpers/http-prueba.js";

describe("admin.qrSistema", () => {
  it("obtener pide format=raw y desenvuelve { qr, phone }", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() =>
      respuestaJsonData({ qr: "2@AbCdEf,GhIj,KlMn==", phone: "593999999999" }),
    );

    const r = await admin.qrSistema.obtener({ formato: "raw" });

    expect(r).toEqual({
      success: true,
      data: { qr: "2@AbCdEf,GhIj,KlMn==", phone: "593999999999" },
    });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("GET");
    expect(enviada.ruta).toBe("/v1/admin/system-qr");
    expect(enviada.query).toEqual({ format: "raw" });
    expect(enviada.cuerpo).toBeUndefined();
    esperarBearer(enviada.headers);
  });

  it("obtener sin formato no manda format (default de la API)", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() =>
      respuestaJsonData({ qr: "2@x", phone: "593999999999" }),
    );

    await admin.qrSistema.obtener();

    expect(peticion(fetchMock).query).toEqual({});
  });

  it("obtener con sesión ya conectada devuelve message y phone, sin qr", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaJsonData({
        message: "La sesión del sistema ya está conectada",
        phone: "593999999999",
      }),
    );

    const r = await admin.qrSistema.obtener({ formato: "base64" });

    expect(r).toEqual({
      success: true,
      data: { message: "La sesión del sistema ya está conectada", phone: "593999999999" },
    });
  });

  it("obtener rechaza un formato inválido sin enviar la request", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData({}));

    // @ts-expect-error formato fuera de "raw" | "base64"
    const r = await admin.qrSistema.obtener({ formato: "png" });

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("obtenerPng entrega bytes y content-type con format=png", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const { admin, fetchMock } = crearAdminPrueba(
      () => new Response(png, { status: 200, headers: { "content-type": "image/png" } }),
    );

    const r = await admin.qrSistema.obtenerPng();

    expect(r).toEqual({ success: true, data: { bytes: png, tipoContenido: "image/png" } });
    const enviada = peticion(fetchMock);
    expect(enviada.ruta).toBe("/v1/admin/system-qr");
    expect(enviada.query).toEqual({ format: "png" });
    esperarBearer(enviada.headers);
  });

  it("obtenerPng con sesión conectada llega como application/json (rareza de la API)", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaJsonData({ message: "La sesión del sistema ya está conectada", phone: "5939" }),
    );

    const r = await admin.qrSistema.obtenerPng();

    expect(r.success).toBe(true);
    expect(r.success && r.data.tipoContenido).toBe("application/json");
  });

  it("mapea el 401 S2S { error: { code, message } } con su codigoApi", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaErrorToken(401, "invalid_signature", "Acceso no autorizado"),
    );

    const r = await admin.qrSistema.obtener();

    expect(r).toMatchObject({
      success: false,
      codigo: 401,
      error: "Acceso no autorizado",
      codigoApi: "invalid_signature",
    });
  });

  it("mapea el 500 al obtener el QR", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaError(500, "Error interno al obtener el QR del sistema"),
    );

    const r = await admin.qrSistema.obtener();

    expect(r).toMatchObject({
      success: false,
      codigo: 500,
      error: "Error interno al obtener el QR del sistema",
    });
  });
});

describe("admin.sesiones", () => {
  it("eliminar hace DELETE /sessions/{phone} y desenvuelve { message }", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() =>
      respuestaJsonData({ message: "Sesion de 573001234567 desconectada" }),
    );

    const r = await admin.sesiones.eliminar({ phone: "573001234567" });

    expect(r).toEqual({
      success: true,
      data: { message: "Sesion de 573001234567 desconectada" },
    });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("DELETE");
    expect(enviada.ruta).toBe("/v1/admin/sessions/573001234567");
    expect(enviada.cuerpo).toBeUndefined();
    esperarBearer(enviada.headers);
  });

  it("mapea el 403 al intentar eliminar la sesión del sistema", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaError(403, "No se puede eliminar la sesion del sistema"),
    );

    const r = await admin.sesiones.eliminar({ phone: "593999999999" });

    expect(r).toMatchObject({
      success: false,
      codigo: 403,
      error: "No se puede eliminar la sesion del sistema",
    });
  });

  it("mapea el 404 sin sesión activa", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaError(404, "No hay sesion activa para este telefono"),
    );

    const r = await admin.sesiones.eliminar({ phone: "573001234567" });

    expect(r).toMatchObject({ success: false, codigo: 404 });
  });

  it("rechaza un teléfono inválido sin enviar la request", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData({}));

    const r = await admin.sesiones.eliminar({ phone: "../admin" });

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("admin.qrSistema: sin reintentos", () => {
  it.each([
    ["obtener", (f: ReturnType<typeof crearFacadeQrSistema>) => f.obtener()],
    ["obtenerPng", (f: ReturnType<typeof crearFacadeQrSistema>) => f.obtenerPng()],
  ])("%s no reintenta ante un 5xx (el GET dispara la sesión del sistema)", async (_n, op) => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaError(503, "caído"), {
      reintentos: { maximo: 2 },
    });

    const r = await op(crearFacadeQrSistema(http));

    expect(r).toMatchObject({ success: false, codigo: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
