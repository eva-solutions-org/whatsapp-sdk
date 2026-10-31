import { describe, expect, it } from "vitest";
import { crearFacadeSeguridad } from "../../../src/features/seguridad/index.js";
import { crearHttpDePrueba } from "../../helpers/http-prueba.js";
import { BASE_URL_PRUEBA, respuestaError, respuestaJsonData } from "../../helpers/mock-fetch.js";

type MockConLlamadas = { mock: { calls: unknown[][] } };
const urlDe = (m: MockConLlamadas) => m.mock.calls[0]?.[0] as string;
const initDe = (m: MockConLlamadas) => m.mock.calls[0]?.[1] as RequestInit;

describe("seguridad.verificarIp", () => {
  it("hace POST JSON a /v1/security/verify-ip y devuelve message + ip", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() =>
      respuestaJsonData({ message: "IP verificada", ip: "203.0.113.7" }),
    );

    const r = await crearFacadeSeguridad(http).verificarIp({ code: "123456" });

    expect(r).toEqual({ success: true, data: { message: "IP verificada", ip: "203.0.113.7" } });
    expect(urlDe(fetchMock)).toBe(`${BASE_URL_PRUEBA}/v1/security/verify-ip`);
    expect(initDe(fetchMock).method).toBe("POST");
    expect(initDe(fetchMock).body).toBe('{"code":"123456"}');
  });

  it("mapea el 400 de código inválido o expirado", async () => {
    const { http } = crearHttpDePrueba(() => respuestaError(400, "Código inválido o expirado"));

    const r = await crearFacadeSeguridad(http).verificarIp({ code: "000000" });

    expect(r).toMatchObject({ success: false, codigo: 400, error: "Código inválido o expirado" });
  });

  it("rechaza un código que no son 6 dígitos sin llamar a la red", async () => {
    const { http, fetchMock } = crearHttpDePrueba(() =>
      respuestaJsonData({ message: "x", ip: "1.1.1.1" }),
    );

    const r = await crearFacadeSeguridad(http).verificarIp({ code: "12345" });

    expect(r).toMatchObject({
      success: false,
      codigo: 422,
      detalles: { fieldErrors: { code: ["El código debe tener 6 dígitos"] } },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
