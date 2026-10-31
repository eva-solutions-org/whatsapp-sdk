import { recolectar } from "../../helpers/iteradores.js";
import { describe, expect, it } from "vitest";
import {
  respuestaError,
  respuestaErrorToken,
  respuestaJson,
  respuestaJsonData,
  respuestaValidacion422,
} from "../../helpers/mock-fetch.js";
import { crearAdminPrueba, esperarBearer, peticion } from "../../helpers/ayudas-token.js";

const ID = "0b9a2f64-5c1e-4f3a-9d6e-3a1f7c2b8e10";

const CLIENT = {
  id: ID,
  clientId: "whatsapp-crm",
  name: "WhatsApp CRM",
  enabled: true,
  allowedSourcePhones: ["51988888888"],
  createdAt: "2026-05-18T10:00:00.000Z",
  updatedAt: "2026-05-18T12:00:00.000Z",
};

describe("admin.serviceClients", () => {
  it("crear hace POST con el id de Auth y entrega el registro local (201)", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(CLIENT, { status: 201 }));

    const r = await admin.serviceClients.crear({
      id: ID,
      clientId: "whatsapp-crm",
      name: "WhatsApp CRM",
      allowedSourcePhones: ["51988888888"],
    });

    expect(r).toEqual({ success: true, data: CLIENT });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("POST");
    expect(enviada.ruta).toBe("/v1/admin/service-clients");
    expect(enviada.cuerpo).toEqual({
      id: ID,
      clientId: "whatsapp-crm",
      name: "WhatsApp CRM",
      allowedSourcePhones: ["51988888888"],
    });
    esperarBearer(enviada.headers);
  });

  it("crear no envía ni espera secreto ni scopes", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() =>
      respuestaJsonData({ ...CLIENT, secret: "no-debe-salir", scopes: ["admin"] }, { status: 201 }),
    );

    const r = await admin.serviceClients.crear({ id: ID, clientId: "whatsapp-crm", name: "N" });

    expect(r).toEqual({ success: true, data: CLIENT });
    expect(JSON.stringify(peticion(fetchMock).cuerpo)).not.toMatch(/secret|scopes/);
  });

  it("crear mapea el 409 de id duplicado", async () => {
    const { admin } = crearAdminPrueba(() => respuestaError(409, "El service client ya existe"));

    const r = await admin.serviceClients.crear({ id: ID, clientId: "whatsapp-crm", name: "N" });

    expect(r).toMatchObject({ success: false, codigo: 409, error: "El service client ya existe" });
  });

  it("crear rechaza un id que no es uuid sin enviar la request", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData({}));

    const r = await admin.serviceClients.crear({
      id: "whatsapp-crm",
      clientId: "x-crm",
      name: "N",
    });

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("listar hace GET con cursor y limit y entrega { data, nextCursor }", async () => {
    const respuesta = { data: [CLIENT], nextCursor: "cur_01abc" };
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJson(respuesta));

    const r = await admin.serviceClients.listar({ cursor: "cur_00zzz", limit: 20 });

    expect(r).toEqual({ success: true, data: respuesta });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("GET");
    expect(enviada.ruta).toBe("/v1/admin/service-clients");
    expect(enviada.query).toEqual({ cursor: "cur_00zzz", limit: "20" });
    esperarBearer(enviada.headers);
  });

  it("listar mapea el 401 por token inválido con su codigoApi", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaErrorToken(401, "invalid_token", "Token inválido o vencido"),
    );

    const r = await admin.serviceClients.listar();

    expect(r).toMatchObject({ success: false, codigo: 401, codigoApi: "invalid_token" });
  });

  it("obtener hace GET /service-clients/{id} y desenvuelve el client", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(CLIENT));

    const r = await admin.serviceClients.obtener({ id: ID });

    expect(r).toEqual({ success: true, data: CLIENT });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("GET");
    expect(enviada.ruta).toBe(`/v1/admin/service-clients/${ID}`);
    esperarBearer(enviada.headers);
  });

  it("obtener mapea el 404", async () => {
    const { admin } = crearAdminPrueba(() => respuestaError(404, "ServiceClient no encontrado"));

    const r = await admin.serviceClients.obtener({ id: "11111111-2222-4333-8444-555555555555" });

    expect(r).toMatchObject({ success: false, codigo: 404 });
  });

  it("obtener con id vacío no cae en la ruta de listado: falla sin enviar", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(CLIENT));

    const r = await admin.serviceClients.obtener({ id: "" });

    expect(r).toMatchObject({ success: false, codigo: 422 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("actualizar hace PATCH con el body sin el id", async () => {
    const actualizado = { ...CLIENT, enabled: false };
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(actualizado));

    const r = await admin.serviceClients.actualizar({ id: ID, enabled: false });

    expect(r).toEqual({ success: true, data: actualizado });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("PATCH");
    expect(enviada.ruta).toBe(`/v1/admin/service-clients/${ID}`);
    expect(enviada.cuerpo).toEqual({ enabled: false });
    esperarBearer(enviada.headers);
  });

  it("actualizar acepta clientId y name y los manda en el body", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(CLIENT));

    await admin.serviceClients.actualizar({ id: ID, clientId: "crm-nuevo", name: "CRM" });

    expect(peticion(fetchMock).cuerpo).toEqual({ clientId: "crm-nuevo", name: "CRM" });
  });

  it("eliminar hace DELETE y desenvuelve { message }", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() =>
      respuestaJsonData({ message: "ServiceClient eliminado" }),
    );

    const r = await admin.serviceClients.eliminar({ id: ID });

    expect(r).toEqual({ success: true, data: { message: "ServiceClient eliminado" } });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("DELETE");
    expect(enviada.ruta).toBe(`/v1/admin/service-clients/${ID}`);
    esperarBearer(enviada.headers);
  });

  it("eliminar mapea el 404 y no reintenta", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaError(404, "No encontrado"));

    const r = await admin.serviceClients.eliminar({ id: ID });

    expect(r).toMatchObject({ success: false, codigo: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("admin.serviceClients.telefonosOrigen", () => {
  const ALLOWLIST = { id: ID, allowedSourcePhones: ["51988888888"] };

  it("listar hace GET /source-phones y desenvuelve la allowlist", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(ALLOWLIST));

    const r = await admin.serviceClients.telefonosOrigen.listar({ id: ID });

    expect(r).toEqual({ success: true, data: ALLOWLIST });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("GET");
    expect(enviada.ruta).toBe(`/v1/admin/service-clients/${ID}/source-phones`);
    esperarBearer(enviada.headers);
  });

  it("agregar hace POST /source-phones con { phone }", async () => {
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(ALLOWLIST));

    const r = await admin.serviceClients.telefonosOrigen.agregar({
      id: ID,
      phone: "51988888888",
    });

    expect(r).toEqual({ success: true, data: ALLOWLIST });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("POST");
    expect(enviada.ruta).toBe(`/v1/admin/service-clients/${ID}/source-phones`);
    expect(enviada.cuerpo).toEqual({ phone: "51988888888" });
    esperarBearer(enviada.headers);
  });

  it("agregar mapea el 422 de la API con sus detalles", async () => {
    const { admin } = crearAdminPrueba(() =>
      respuestaValidacion422({ phone: ["Número de teléfono inválido"] }),
    );

    const r = await admin.serviceClients.telefonosOrigen.agregar({
      id: ID,
      phone: "51988888888",
    });

    expect(r).toMatchObject({
      success: false,
      codigo: 422,
      detalles: { fieldErrors: { phone: ["Número de teléfono inválido"] } },
    });
  });

  it("quitar hace DELETE /source-phones/{phone}", async () => {
    const vacia = { id: ID, allowedSourcePhones: [] };
    const { admin, fetchMock } = crearAdminPrueba(() => respuestaJsonData(vacia));

    const r = await admin.serviceClients.telefonosOrigen.quitar({
      id: ID,
      phone: "51988888888",
    });

    expect(r).toEqual({ success: true, data: vacia });
    const enviada = peticion(fetchMock);
    expect(enviada.metodo).toBe("DELETE");
    expect(enviada.ruta).toBe(`/v1/admin/service-clients/${ID}/source-phones/51988888888`);
    esperarBearer(enviada.headers);
  });
});

describe("admin.serviceClients.iterar", () => {
  it("sigue nextCursor hasta null", async () => {
    const { admin, fetchMock } = crearAdminPrueba((url) => {
      const cursor = new URL(url).searchParams.get("cursor");
      return cursor === null
        ? respuestaJson({ data: [{ ...CLIENT, clientId: "uno" }], nextCursor: "c2" })
        : respuestaJson({ data: [{ ...CLIENT, clientId: "dos" }], nextCursor: null });
    });

    const items = await recolectar(admin.serviceClients.iterar({ limit: 1 }));

    expect(items.map((c) => c.clientId)).toEqual(["uno", "dos"]);
    expect(peticion(fetchMock, 0).query).toEqual({ limit: "1" });
    expect(peticion(fetchMock, 1).query).toEqual({ limit: "1", cursor: "c2" });
  });
});
