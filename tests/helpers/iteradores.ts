/** Consume un async iterator completo y devuelve sus items. */
export const recolectar = async <T>(iterable: AsyncIterable<T>): Promise<T[]> => {
  const items: T[] = [];
  for await (const item of iterable) {
    items.push(item);
  }
  return items;
};
