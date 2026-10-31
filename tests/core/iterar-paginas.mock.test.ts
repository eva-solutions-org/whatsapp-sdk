import { describe, expect, it, vi } from "vitest";
import { iterarCursor, iterarPaginas } from "../../src/core/paginacion/index.js";
import type { Resultado } from "../../src/core/types/index.js";
import { recolectar } from "../helpers/iteradores.js";

const pagina = <T>(
  data: T[],
  totalPages: number,
): Resultado<{ data: T[]; pagination: { totalPages: number } }> => ({
  success: true,
  data: { data, pagination: { totalPages } },
});

describe("iterarPaginas", () => {
  it("recorre de la página 1 a la última, en orden", async () => {
    const obtener = vi.fn(async (n: number) => pagina([`a${n}`, `b${n}`], 3));

    expect(await recolectar(iterarPaginas(obtener))).toEqual(["a1", "b1", "a2", "b2", "a3", "b3"]);
    expect(obtener.mock.calls.map(([n]) => n)).toEqual([1, 2, 3]);
  });

  it("un break del consumidor no pide más páginas", async () => {
    const obtener = vi.fn(async (n: number) => pagina([n], 5));

    for await (const item of iterarPaginas(obtener)) {
      if (item === 2) break;
    }

    expect(obtener).toHaveBeenCalledTimes(2);
  });

  it("una página vacía corta aunque totalPages diga más", async () => {
    const obtener = vi.fn(async () => pagina<number>([], 9));

    expect(await recolectar(iterarPaginas(obtener))).toEqual([]);
    expect(obtener).toHaveBeenCalledTimes(1);
  });

  it("lanza un Error con el Resultado de falla en cause", async () => {
    const fallo: Resultado<never> = {
      success: false,
      error: "caído",
      codigo: 503,
      origen: "transporte",
    };
    const obtener = async (n: number) => (n === 1 ? pagina([1], 2) : fallo);

    const err = await recolectar(iterarPaginas(obtener)).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("caído");
    expect((err as Error).cause).toEqual(fallo);
  });
});

describe("iterarCursor", () => {
  type Resp = { items: string[]; next: string | null };
  const leer = (r: Resp) => ({ items: r.items, siguiente: r.next });

  it("sigue el cursor hasta que no hay siguiente", async () => {
    const paginas: Record<string, Resp> = {
      inicio: { items: ["a"], next: "c2" },
      c2: { items: ["b"], next: "c3" },
      c3: { items: ["c"], next: null },
    };
    const obtener = vi.fn(
      async (cursor: string | undefined): Promise<Resultado<Resp>> => ({
        success: true,
        data: paginas[cursor ?? "inicio"] as Resp,
      }),
    );

    expect(await recolectar(iterarCursor(obtener, leer))).toEqual(["a", "b", "c"]);
    expect(obtener.mock.calls.map(([c]) => c)).toEqual([undefined, "c2", "c3"]);
  });

  it("un cursor repetido corta (no hay bucle infinito)", async () => {
    const obtener = vi.fn(
      async (): Promise<Resultado<Resp>> => ({
        success: true,
        data: { items: ["x"], next: "mismo" },
      }),
    );

    expect(await recolectar(iterarCursor(obtener, leer))).toEqual(["x", "x"]);
    expect(obtener).toHaveBeenCalledTimes(2);
  });

  it("lanza un Error con el Resultado de falla en cause", async () => {
    const fallo: Resultado<Resp> = {
      success: false,
      error: "cursor inválido",
      codigo: 400,
      origen: "local",
    };

    const err = await recolectar(iterarCursor(async () => fallo, leer)).catch((e: unknown) => e);

    expect((err as Error).cause).toEqual(fallo);
  });
});
