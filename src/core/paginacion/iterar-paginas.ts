import type { Resultado } from "../types/index.js";

/** Listado paginado por número de página (`{ data, pagination: { totalPages } }`). */
export interface PaginaPorNumero<T> {
  data: readonly T[];
  pagination: { totalPages: number };
}

/**
 * Convierte un fallo del `Resultado` en el error que lanzan los iteradores. El `Resultado` de
 * falla original queda en `cause` (`codigo`, `requestId`, `detalles`...).
 */
const errorDeIteracion = (fallo: { error: string }): Error =>
  new Error(fallo.error, { cause: fallo });

/**
 * Async iterator que recorre un listado paginado por número de página, de la 1 a la última.
 *
 * EXCEPCIÓN DOCUMENTADA al Result Pattern (idiomático en SDKs: Stripe, AWS, Octokit): cede los
 * items directos y, ante un fallo de cualquier página, lanza un `Error` cuyo `cause` es el
 * `Resultado` de falla. Un `break` del consumidor detiene la paginación (no se piden más páginas).
 *
 * `obtenerPagina(pagina)` es la operación `listar` del feature con los filtros ya aplicados.
 *
 * ```ts
 * for await (const p of cliente.programados.iterar({ limit: 50 })) { ... }
 * ```
 */
export async function* iterarPaginas<T>(
  obtenerPagina: (pagina: number) => Promise<Resultado<PaginaPorNumero<T>>>,
): AsyncGenerator<T, void, undefined> {
  for (let pagina = 1; ; pagina++) {
    const resultado = await obtenerPagina(pagina);
    if (!resultado.success) {
      throw errorDeIteracion(resultado);
    }
    yield* resultado.data.data;
    // Una página vacía corta también: protege de un `totalPages` inconsistente.
    if (pagina >= resultado.data.pagination.totalPages || resultado.data.data.length === 0) {
      return;
    }
  }
}

/** Una página de un listado por cursor, ya normalizada. */
export interface PaginaPorCursor<T> {
  items: readonly T[];
  /** Cursor de la página siguiente; `null`/`undefined` si no hay más. */
  siguiente: string | null | undefined;
}

/**
 * Como `iterarPaginas`, para listados paginados por cursor. `leer` normaliza la respuesta de
 * cada feature (`{ data, nextCursor }` o `{ items, pagination: { nextCursor, hasMore } }`).
 */
export async function* iterarCursor<R, T>(
  obtenerPagina: (cursor: string | undefined) => Promise<Resultado<R>>,
  leer: (respuesta: R) => PaginaPorCursor<T>,
): AsyncGenerator<T, void, undefined> {
  let cursor: string | undefined;
  for (;;) {
    const resultado = await obtenerPagina(cursor);
    if (!resultado.success) {
      throw errorDeIteracion(resultado);
    }
    const pagina = leer(resultado.data);
    yield* pagina.items;
    // Un cursor repetido o una página vacía cortan: evita un bucle infinito ante una API rota.
    if (!pagina.siguiente || pagina.siguiente === cursor || pagina.items.length === 0) {
      return;
    }
    cursor = pagina.siguiente;
  }
}
