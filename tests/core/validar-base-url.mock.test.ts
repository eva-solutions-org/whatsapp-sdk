import { describe, expect, it } from "vitest";
import { validarBaseUrl } from "../../src/core/cliente/validar-base-url.js";
import { ErrorConfiguracion } from "../../src/core/errors/index.js";

describe("validarBaseUrl", () => {
  it.each([
    ["https://api.ejemplo.com", "https://api.ejemplo.com"],
    ["https://api.ejemplo.com/", "https://api.ejemplo.com"],
    ["https://API.Ejemplo.com:8443", "https://api.ejemplo.com:8443"],
    ["http://localhost:6000", "http://localhost:6000"],
    ["http://127.0.0.1:3000", "http://127.0.0.1:3000"],
    ["http://[::1]:3000", "http://[::1]:3000"],
  ])("acepta %s y retorna el origin %s", (entrada, esperado) => {
    expect(validarBaseUrl(entrada)).toBe(esperado);
  });

  it.each([
    ["http remoto", "http://api.ejemplo.com", "https"],
    ["path", "https://api.ejemplo.com/v1", "origin sin path"],
    ["query", "https://api.ejemplo.com?x=1", "query"],
    ["query vacío", "https://api.ejemplo.com?", "query"],
    ["fragmento", "https://api.ejemplo.com#x", "fragmento"],
    ["credenciales", "https://usuario:clave@api.ejemplo.com", "credenciales"],
    ["malformada", "no es una url", "malformada"],
    ["esquema ajeno", "ftp://api.ejemplo.com", "https"],
  ])("rechaza %s con un mensaje que no repite el valor", (_caso, entrada, fragmento) => {
    let error: unknown;
    try {
      validarBaseUrl(entrada);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(ErrorConfiguracion);
    const mensaje = (error as Error).message;
    expect(mensaje).toContain(fragmento);
    expect(mensaje).not.toContain(entrada);
  });

  it.each([undefined, null, 42, ""])("rechaza el valor no string o vacío %s", (valor) => {
    expect(() => validarBaseUrl(valor)).toThrow(ErrorConfiguracion);
  });
});
