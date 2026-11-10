import { z } from "zod";

/**
 * Teléfono de la vía interna: 7 a 20 caracteres, como `phone` y `sourcePhone` de
 * `internal-mensajes` (la API valida el formato fino).
 */
const telefonoInternoSchema = z.string().min(7).max(20);

export const esTelefonoInterno = (valor: unknown): valor is string =>
  telefonoInternoSchema.safeParse(valor).success;

/** Tope de `segundos` de la presencia temporal (igual que la vía pública). */
const MAX_SEGUNDOS_ESCRITURA = 25;

export const verificarExistenciaInternoInputSchema = z.strictObject({
  /** Número a consultar (E.164 sin `+`). */
  phone: telefonoInternoSchema,
  /** Número remitente: debe estar en la allowlist del service client y tener sesión vinculada. */
  sourcePhone: telefonoInternoSchema,
});
export type VerificarExistenciaInternoInput = z.input<typeof verificarExistenciaInternoInputSchema>;

export const indicarEscrituraInternoInputSchema = z.strictObject({
  phone: telefonoInternoSchema,
  sourcePhone: telefonoInternoSchema,
  estado: z.enum(["escribiendo", "grabando", "pausa"]),
  /** 1 a 25: el indicador vuelve a "pausa" solo. Con `estado: "pausa"` se ignora. */
  segundos: z.number().int().min(1).max(MAX_SEGUNDOS_ESCRITURA).optional(),
});
export type IndicarEscrituraInternoInput = z.input<typeof indicarEscrituraInternoInputSchema>;

/** `{ exists }` (ya desenvuelto de `{ data }`). */
export const existenciaNumeroInternoSchema = z.object({ exists: z.boolean() });
export type ExistenciaNumeroInterno = z.infer<typeof existenciaNumeroInternoSchema>;
