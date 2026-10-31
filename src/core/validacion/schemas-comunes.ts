import { z } from "zod";

/** Monedas ISO 4217 que acepta la API (`MONEDAS_SOPORTADAS` de billing). */
const MONEDAS_SOPORTADAS = ["USD", "EUR", "ARS", "BRL", "MXN", "CLP", "COP", "PEN", "UYU"] as const;

export const monedaSchema = z.enum(MONEDAS_SOPORTADAS);

/** Teléfono internacional sin `+`, de 7 a 15 dígitos (`phoneSchema` de la API). */
export const telefonoSchema = z
  .string()
  .regex(/^[1-9][0-9]{6,14}$/, "Número de teléfono inválido (7 a 15 dígitos, sin +)");

/** Id o slug que va como segmento de path: nunca vacío (un vacío apuntaría a otra ruta). */
export const idSchema = z.string().min(1);

/** Decimal como string, con signo opcional (la API serializa los Decimal de Prisma así). */
export const decimalSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?$/, "Debe ser un número decimal válido");

/** Decimal como string sin signo (config de billing). */
export const decimalNoNegativoSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Debe ser un número decimal válido sin signo");

/** Fecha ISO 8601 en UTC (`Z`), como la valida la API. */
export const fechaIsoSchema = z.iso.datetime();

/** Paginación por página de la API (`{ page, limit, total, totalPages }`). */
export const paginacionSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

/** `{ message }` de confirmación (ya desenvuelto de `{ data }`). */
export const mensajeConfirmacionSchema = z.object({ message: z.string() });
export type MensajeConfirmacion = z.infer<typeof mensajeConfirmacionSchema>;

/**
 * Enum de RESPUESTA tolerante (forward-compat): acepta cualquier string, de modo que un valor
 * nuevo que agregue la API no rompa el parseo de toda la respuesta. El tipo conserva el
 * autocompletado de los valores conocidos (`Conocido | (string & {})`). Los enums de ENTRADA
 * siguen siendo `z.enum` estrictos.
 */
export const enumTolerante = <const T extends readonly [string, ...string[]]>(_conocidos: T) =>
  z.custom<T[number] | (string & {})>((valor) => typeof valor === "string");

/** Tipos de movimiento de billing que conoce la API (compartido por `.` y `./admin`). */
export const TIPOS_MOVIMIENTO = [
  "recarga",
  "cobro_saliente",
  "cobro_entrante",
  "consumo_gratis",
  "reembolso",
  "ajuste_manual",
  "conversion_moneda",
] as const;
