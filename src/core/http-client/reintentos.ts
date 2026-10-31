/**
 * Política de reintentos del http client.
 *
 * - `maximo`: reintentos adicionales al primer intento (default 2; `0` desactiva).
 * - `esperaBaseMs`: base del backoff exponencial (default 250 ms: 250, 500, 1000...).
 * - `esperaMaximaMs`: tope de una espera (default 10 000 ms). Si la API pide con
 *   `Retry-After` esperar más que esto, NO se reintenta y el 429 llega al consumidor con
 *   `retryAfter` para que decida.
 *
 * Por defecto se reintentan GET y DELETE (idempotentes) ante error de red/timeout, 5xx y 429. Los
 * features del SDK desactivan el reintento en todos sus DELETE (`reintentar: false`): tras un
 * éxito con la respuesta perdida, el reintento devolvería 404.
 * Un POST/PUT nunca se reintenta por defecto: podría duplicar un mensaje. Cada operación puede
 * fijarlo con `reintentar` (p. ej. `false` en un GET con efecto lateral).
 */
export interface OpcionesReintentos {
  maximo?: number;
  esperaBaseMs?: number;
  esperaMaximaMs?: number;
}

export const REINTENTOS_POR_DEFECTO: Required<OpcionesReintentos> = {
  maximo: 2,
  esperaBaseMs: 250,
  esperaMaximaMs: 10_000,
};

export const esMetodoIdempotente = (method: string): boolean =>
  method === "GET" || method === "DELETE";

export const esStatusReintentable = (status: number): boolean => status === 429 || status >= 500;

/**
 * Backoff exponencial con jitter (entre 50 % y 100 % del valor calculado) para que varios
 * clientes que fallaron a la vez no reintenten sincronizados.
 */
export const calcularEsperaBackoff = ({
  intento,
  esperaBaseMs,
  esperaMaximaMs,
  aleatorio,
}: {
  intento: number;
  esperaBaseMs: number;
  esperaMaximaMs: number;
  aleatorio: () => number;
}): number => {
  const exponencial = Math.min(esperaMaximaMs, esperaBaseMs * 2 ** intento);
  return Math.round(exponencial * (0.5 + aleatorio() / 2));
};

/** Espera `ms`; se resuelve antes si `signal` aborta (el llamador revisa el abort). */
export const dormirAbortable = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolver) => {
    if (signal?.aborted === true) {
      resolver();
      return;
    }
    const alAbortar = () => {
      clearTimeout(temporizador);
      resolver();
    };
    const temporizador = setTimeout(() => {
      signal?.removeEventListener("abort", alAbortar);
      resolver();
    }, ms);
    signal?.addEventListener("abort", alAbortar, { once: true });
  });
