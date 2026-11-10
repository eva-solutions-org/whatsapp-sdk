/** Tope de números recordados: en un proceso largo el mapa no debe crecer sin límite. */
const MAXIMO_ENTRADAS = 10_000;

interface Entrada {
  existe: boolean;
  venceEn: number;
}

/**
 * Caché en memoria de la existencia de un número en WhatsApp. Un positivo y un negativo tienen
 * TTL propio; un TTL de 0 no cachea ese caso. Al llegar al tope se descarta el más antiguo.
 */
export const crearCacheExistencia = ({
  ttlExisteMs,
  ttlInexistenteMs,
  ahora,
}: {
  ttlExisteMs: number;
  ttlInexistenteMs: number;
  ahora: () => number;
}) => {
  const entradas = new Map<string, Entrada>();

  return {
    /** `undefined` si no hay dato vigente. */
    obtener: (phone: string): boolean | undefined => {
      const entrada = entradas.get(phone);
      if (entrada === undefined) return undefined;
      if (entrada.venceEn <= ahora()) {
        entradas.delete(phone);
        return undefined;
      }
      return entrada.existe;
    },
    guardar: (phone: string, existe: boolean): void => {
      const ttl = existe ? ttlExisteMs : ttlInexistenteMs;
      if (ttl === 0) return;
      entradas.delete(phone);
      if (entradas.size >= MAXIMO_ENTRADAS) {
        const masAntigua = entradas.keys().next().value;
        if (masAntigua !== undefined) entradas.delete(masAntigua);
      }
      entradas.set(phone, { existe, venceEn: ahora() + ttl });
    },
  };
};
