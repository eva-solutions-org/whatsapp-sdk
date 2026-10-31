import { describe, expect, it } from "vitest";
import { crearFacadeBillingAdmin } from "../../src/features/admin-billing/application/index.js";
import { crearFacadeServiceClients } from "../../src/features/admin-service-clients/application/index.js";
import { crearFacadeSesiones } from "../../src/features/admin-sesiones/application/index.js";
import { crearFacadeBufferWs } from "../../src/features/buffer-ws/index.js";
import { crearFacadeProgramados } from "../../src/features/programados/index.js";
import { crearFacadeWebhooksFallidos } from "../../src/features/webhooks-fallidos/index.js";
import type { HttpClient } from "../../src/core/http-client/index.js";
import { crearHttpDePrueba } from "../helpers/http-prueba.js";
import { respuestaError } from "../helpers/mock-fetch.js";

/**
 * Un DELETE con efecto (desconectar una sesión, cancelar un programado...) no se reintenta:
 * si el primer intento sí se ejecutó y solo se perdió la respuesta, el reintento recibiría un
 * 404 que oculta el éxito real.
 */
const OPERACIONES_DELETE: [string, (http: HttpClient) => Promise<unknown>][] = [
  ["admin.sesiones.eliminar", (h) => crearFacadeSesiones(h).eliminar({ phone: "573001234567" })],
  ["programados.cancelar", (h) => crearFacadeProgramados(h).cancelar(7)],
  [
    "admin.billing.precios.desactivar",
    (h) => crearFacadeBillingAdmin(h).precios.desactivar({ moneda: "USD" }),
  ],
  [
    "admin.serviceClients.eliminar",
    (h) => crearFacadeServiceClients(h).eliminar({ slug: "mi-client" }),
  ],
  [
    "admin.serviceClients.telefonosOrigen.quitar",
    (h) =>
      crearFacadeServiceClients(h).telefonosOrigen.quitar({
        slug: "mi-client",
        phone: "573001234567",
      }),
  ],
  ["bufferWs.eliminarTodos", (h) => crearFacadeBufferWs(h).eliminarTodos()],
  ["bufferWs.eliminar", (h) => crearFacadeBufferWs(h).eliminar(3)],
  ["webhooksFallidos.descartar", (h) => crearFacadeWebhooksFallidos(h).descartar(3)],
];

describe("DELETE con efecto: sin reintentos", () => {
  it.each(OPERACIONES_DELETE)("%s hace un solo intento ante un 503", async (_nombre, operacion) => {
    const { http, fetchMock } = crearHttpDePrueba(() => respuestaError(503, "caído"), {
      reintentos: { maximo: 2 },
    });

    const r = await operacion(http);

    expect(r).toMatchObject({ success: false, codigo: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
