import type { OpcionesReconexion } from "../domain/index.js";

export const RECONEXION_POR_DEFECTO: Required<OpcionesReconexion> = {
  baseMs: 1000,
  maxMs: 30_000,
  factor: 2,
  jitter: 0.5,
  maxIntentos: 10,
  estabilidadMs: 10_000,
};

/**
 * Espera antes del reintento `intento` (1 = primero): `base * factor^(intento-1)` con tope
 * `maxMs`, menos una fracción aleatoria de hasta `jitter` (evita que muchos clientes
 * reconecten a la vez).
 */
export const calcularEspera = (
  intento: number,
  config: Required<OpcionesReconexion>,
  aleatorio: () => number,
): number => {
  const exponencial = Math.min(config.maxMs, config.baseMs * config.factor ** (intento - 1));
  return Math.round(exponencial * (1 - config.jitter * aleatorio()));
};
