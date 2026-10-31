import { recolectar } from "../../helpers/iteradores.js";
import { describe, expect, it } from "vitest";
import {
  respuestaError,
  respuestaErrorS2S,
  respuestaJson,
  respuestaJsonData,
  respuestaValidacion422,
} from "../../helpers/mock-fetch.js";
import { crearAdminPrueba, esperarHeadersS2S, peticion } from "../../helpers/ayudas-s2s.js";

const CLIENT = {
  id: "csc_01abc",
  slug: "whatsapp-crm",
  name: "WhatsApp CRM",
  enabled: true,
  scopes: ["messages:send:text", "messages:send:media"],
  lastUsedAt: "2026-05-18T12:00:00.000Z",
  createdAt: "2026-05-18T10:00:00.000Z",
  updatedAt: "2026-05-18T12:00:00.000Z",
};

describe("admin.serviceClients", () => {
  it("crear hace POST y entrega el client con su secret (201)", async () => {
    const data = { ...CLIENT, lastUsedAt: null, secret: "secreto-de-prueba-solo-fixture" };
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(data, { status: 201 }));

    const r = await admin.serviceClients.crear({
      slug: "whatsapp-crm",
      name: "WhatsApp CRM",
      scopes: ["messages:send:text"],
      enabled: true,
    });

    expect(r).toEqual({ success: true, data });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("POST");
    expect(enviada.ruta).toBe("/v1/admin/service-clients");
    expect(enviada.cuerpo).toEqual({
      slug: "whatsapp-crm",
      name: "WhatsApp CRM",
      scopes: ["messages:send:text"],
      enabled: true,
    });
    esperarHeadersS2S(enviada.headers);
  });

  it("crear mapea el 409 de slug duplicado", async () => {
    const { admin } = crearAdminPrueba(() => respuestaError(409, "El slug ya existe"));

    const r = await admin.serviceClients.crear({
      slug: "whatsapp-crm",
      name: "WhatsApp CRM",
      scopes: ["messages:send:text"],
    });

    expect(r).toMatchObject({ success: false, codigo: 409, error: "El slug ya existe" });
  });

  it("crear rechaza scopes vacíos sin enviar la request", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData({}));

    const r = await admin.serviceClients.crear({ slug: "nuevo-servicio", name: "N", scopes: [] });

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("listar hace GET con cursor y limit y entrega { data, nextCursor }", async () => {
    const respuesta = { data: [CLIENT], nextCursor: "csc_01abc" };
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJson(respuesta));

    const r = await admin.serviceClients.listar({ cursor: "csc_00zzz", limit: 20 });

    expect(r).toEqual({ success: true, data: respuesta });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("GET");
    expect(enviada.ruta).toBe("/v1/admin/service-clients");
    expect(enviada.query).toEqual({ cursor: "csc_00zzz", limit: "20" });
    esperarHeadersS2S(enviada.headers);
  });

  it("listar mapea el 401 S2S con su codigoApi", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaErrorS2S(401, "replay_detected", "Acceso no autorizado"),
    );

    const r = await admin.serviceClients.listar();

    expect(r).toMatchObject({ success: false, codigo: 401, codigoApi: "replay_detected" });
  });

  it("obtener hace GET /service-clients/{slug} y desenvuelve el client", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(CLIENT));

    const r = await admin.serviceClients.obtener({ slug: "whatsapp-crm" });

    expect(r).toEqual({ success: true, data: CLIENT });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("GET");
    expect(enviada.ruta).toBe("/v1/admin/service-clients/whatsapp-crm");
    esperarHeadersS2S(enviada.headers);
  });

  it("obtener mapea el 404", async () => {
    const { admin } = crearAdminPrueba(() => respuestaError(404, "ServiceClient no encontrado"));

    const r = await admin.serviceClients.obtener({ slug: "no-existe" });

    expect(r).toMatchObject({ success: false, codigo: 404 });
  });

  it("obtener con slug vacío no cae en la ruta de listado: falla sin enviar", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(CLIENT));

    const r = await admin.serviceClients.obtener({ slug: "" });

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("actualizar hace PATCH con el body sin el slug", async () => {
    const actualizado = { ...CLIENT, enabled: false };
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(actualizado));

    const r = await admin.serviceClients.actualizar({ slug: "whatsapp-crm", enabled: false });

    expect(r).toEqual({ success: true, data: actualizado });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("PATCH");
    expect(enviada.ruta).toBe("/v1/admin/service-clients/whatsapp-crm");
    expect(enviada.cuerpo).toEqual({ enabled: false });
    esperarHeadersS2S(enviada.headers);
  });

  it("actualizar mapea el 409 de último admin habilitado", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaError(409, "La operación dejaría al sistema sin un service client admin habilitado"),
    );

    const r = await admin.serviceClients.actualizar({ slug: "panel-admin", enabled: false });

    expect(r).toMatchObject({
      success: false,
      codigo: 409,
      error: "La operación dejaría al sistema sin un service client admin habilitado",
    });
  });

  it("eliminar hace DELETE y desenvuelve { message }", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() =>
      respuestaJsonData({ message: "ServiceClient eliminado" }),
    );

    const r = await admin.serviceClients.eliminar({ slug: "whatsapp-crm" });

    expect(r).toEqual({ success: true, data: { message: "ServiceClient eliminado" } });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("DELETE");
    expect(enviada.ruta).toBe("/v1/admin/service-clients/whatsapp-crm");
    esperarHeadersS2S(enviada.headers);
  });

  it("eliminar mapea el 409 de último admin habilitado", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaError(409, "No se puede eliminar el último service client admin habilitado"),
    );

    const r = await admin.serviceClients.eliminar({ slug: "panel-admin" });

    expect(r).toMatchObject({ success: false, codigo: 409 });
  });

  it("rotarSecret hace POST /rotate-secret sin body y entrega el secret nuevo", async () => {
    const data = {
      slug: "whatsapp-crm",
      secret: "f1e2d3-secreto-de-prueba-solo-fixture",
      rotatedAt: "2026-05-18T15:00:00.000Z",
    };
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(data));

    const r = await admin.serviceClients.rotarSecret({ slug: "whatsapp-crm" });

    expect(r).toEqual({ success: true, data });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("POST");
    expect(enviada.ruta).toBe("/v1/admin/service-clients/whatsapp-crm/rotate-secret");
    expect(enviada.cuerpo).toBeUndefined();
    esperarHeadersS2S(enviada.headers);
  });

  it("rotarSecret mapea el 400 de la fila auth-service", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaError(400, "auth-service no tiene secret HMAC que rotar"),
    );

    const r = await admin.serviceClients.rotarSecret({ slug: "auth-service" });

    expect(r).toMatchObject({ success: false, codigo: 400 });
  });
});

describe("admin.serviceClients.telefonosOrigen", () => {
  const ALLOWLIST = { slug: "whatsapp-crm", allowedSourcePhones: ["51988888888"] };

  it("listar hace GET /source-phones y desenvuelve la allowlist", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(ALLOWLIST));

    const r = await admin.serviceClients.telefonosOrigen.listar({ slug: "whatsapp-crm" });

    expect(r).toEqual({ success: true, data: ALLOWLIST });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("GET");
    expect(enviada.ruta).toBe("/v1/admin/service-clients/whatsapp-crm/source-phones");
    esperarHeadersS2S(enviada.headers);
  });

  it("agregar hace POST /source-phones con { phone }", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(ALLOWLIST));

    const r = await admin.serviceClients.telefonosOrigen.agregar({
      slug: "whatsapp-crm",
      phone: "51988888888",
    });

    expect(r).toEqual({ success: true, data: ALLOWLIST });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("POST");
    expect(enviada.ruta).toBe("/v1/admin/service-clients/whatsapp-crm/source-phones");
    expect(enviada.cuerpo).toEqual({ phone: "51988888888" });
    esperarHeadersS2S(enviada.headers);
  });

  it("agregar mapea el 422 de la API con sus detalles", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaValidacion422({ phone: ["Número de teléfono inválido"] }),
    );

    const r = await admin.serviceClients.telefonosOrigen.agregar({
      slug: "whatsapp-crm",
      phone: "51988888888",
    });

    expect(r).toMatchObject({
      success: false,
      codigo: 422,
      detalles: { fieldErrors: { phone: ["Número de teléfono inválido"] } },
    });
  });

  it("quitar hace DELETE /source-phones/{phone}", async () => {
    const vacia = { slug: "whatsapp-crm", allowedSourcePhones: [] };
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(vacia));

    const r = await admin.serviceClients.telefonosOrigen.quitar({
      slug: "whatsapp-crm",
      phone: "51988888888",
    });

    expect(r).toEqual({ success: true, data: vacia });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("DELETE");
    expect(enviada.ruta).toBe("/v1/admin/service-clients/whatsapp-crm/source-phones/51988888888");
    esperarHeadersS2S(enviada.headers);
  });
});

describe("admin.serviceClients.iterar", () => {
  it("sigue nextCursor hasta null", async () => {
    const { admin, fetchMock } = crearAdminPrueba((url) => {
      const cursor = new URL(url).searchParams.get("cursor");
      return cursor === null
        ? respuestaJson({ data: [{ ...CLIENT, slug: "uno" }], nextCursor: "c2" })
        : respuestaJson({ data: [{ ...CLIENT, slug: "dos" }], nextCursor: null });
    });

    const items = await recolectar(admin.serviceClients.iterar({ limit: 1 }));

    expect(items.map((c) => c.slug)).toEqual(["uno", "dos"]);
    expect(peticion(fetchMock, 0).query).toEqual({ limit: "1" });
    expect(peticion(fetchMock, 1).query).toEqual({ limit: "1", cursor: "c2" });
  });
});
