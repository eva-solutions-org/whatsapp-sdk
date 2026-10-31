import { describe, expect, it } from "vitest";
import { esExitoso, esFallido } from "../../src/core/types/index.js";
import type { Resultado } from "../../src/core/types/index.js";

describe("guards de Resultado", () => {
  const ok: Resultado<number> = { success: true, data: 5 };
  const fallo: Resultado<number> = {
    success: false,
    codigo: 404,
    origen: "api",
    error: "no existe",
  };

  it("esExitoso es true solo para el éxito", () => {
    expect(esExitoso(ok)).toBe(true);
    expect(esExitoso(fallo)).toBe(false);
  });

  it("esFallido es true solo para el fallo", () => {
    expect(esFallido(fallo)).toBe(true);
    expect(esFallido(ok)).toBe(false);
  });
});
