import { describe, expect, it } from "vitest";
import { construirConexionWs } from "../../../src/features/ws/infrastructure/index.js";
import {
  calcularEspera,
  RECONEXION_POR_DEFECTO,
} from "../../../src/features/ws/application/index.js";

describe("construirConexionWs", () => {
  it("https -> wss y http loopback -> ws", () => {
    expect(construirConexionWs("https://a.example.com", "k").url).toBe(
      "wss://a.example.com/v1/ws/events",
    );
    expect(construirConexionWs("http://127.0.0.1:8080", "k").url).toBe(
      "ws://127.0.0.1:8080/v1/ws/events",
    );
  });
});

describe("calcularEspera", () => {
  it("crece exponencial, topa en maxMs y el jitter solo resta", () => {
    const c = { ...RECONEXION_POR_DEFECTO, baseMs: 100, maxMs: 500, factor: 2, jitter: 0.5 };

    expect([1, 2, 3, 4].map((n) => calcularEspera(n, c, () => 0))).toEqual([100, 200, 400, 500]);
    expect(calcularEspera(1, c, () => 1)).toBe(50);
  });
});
