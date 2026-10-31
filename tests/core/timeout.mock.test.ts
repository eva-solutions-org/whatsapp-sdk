import { afterEach, describe, expect, it, vi } from "vitest";
import { crearCliente } from "../../src/core/cliente/index.js";
import { crearFacadeMensajes } from "../../src/features/mensajes/index.js";
import { API_KEY_TEST } from "../helpers/fixtures.js";
import { crearHttpDePrueba } from "../helpers/http-prueba.js";
import { BASE_URL_PRUEBA, crearMockFetch, respuestaJsonData } from "../helpers/mock-fetch.js";

afterEach(() => {
  vi.restoreAllMocks();
});

const TEXTO = { phone: "593999999999", message: "hola" };

describe("timeout por intento", () => {
  it("el default del cliente es 35 s (cubre la espera de QR de 30 s y de sesión de 15 s)", async () => {
    const espiar = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = crearMockFetch(() => respuestaJsonData({ message: "ok" }));
    const cliente = crearCliente({
      baseUrl: BASE_URL_PRUEBA,
      apiKey: API_KEY_TEST,
      fetch: fetchMock,
    });

    await cliente.mensajes.enviarTexto(TEXTO);

    expect(espiar).toHaveBeenCalledWith(35_000);
  });

  it("el timeout del cliente aplica cuando la operación no lo define", async () => {
    const espiar = vi.spyOn(AbortSignal, "timeout");
    const { http } = crearHttpDePrueba(() => respuestaJsonData({ message: "ok" }), {
      timeout: 7_000,
    });

    await crearFacadeMensajes(http).enviarTexto(TEXTO);

    expect(espiar).toHaveBeenCalledWith(7_000);
  });

  it("el timeout de la operación sobreescribe al del cliente", async () => {
    const espiar = vi.spyOn(AbortSignal, "timeout");
    const { http } = crearHttpDePrueba(() => respuestaJsonData({ message: "ok" }), {
      timeout: 7_000,
    });

    await crearFacadeMensajes(http).enviarTexto(TEXTO, { timeout: 40_000 });

    expect(espiar).toHaveBeenCalledWith(40_000);
    expect(espiar).not.toHaveBeenCalledWith(7_000);
  });

  it("el timeout de la operación vence aunque el del cliente sea mayor", async () => {
    const { http } = crearHttpDePrueba(
      (_url, init) =>
        new Promise<Response>((_ok, rechazar) => {
          init.signal?.addEventListener("abort", () =>
            rechazar(new DOMException("aborted", "AbortError")),
          );
        }),
      { timeout: 60_000 },
    );

    const r = await http.get("/v1/algo", { timeout: 20 });

    expect(r).toEqual({
      success: false,
      codigo: 503,
      origen: "transporte",
      error: "Tiempo de espera agotado",
    });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, "5000" as unknown as number])(
    "rechaza sin enviar una operación con timeout inválido (%s)",
    async (timeout) => {
      const { http, fetchMock } = crearHttpDePrueba(() => respuestaJsonData({ message: "ok" }));

      const r = await crearFacadeMensajes(http).enviarTexto(TEXTO, { timeout });

      expect(r).toEqual({
        success: false,
        codigo: 400,
        origen: "local",
        error: "timeout debe ser un número > 0 (ms)",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});
