import { z } from "zod";
import { telefonoSchema } from "../../../core/validacion/index.js";

export const eliminarSesionInputSchema = z.object({ phone: telefonoSchema });
export type EliminarSesionInput = z.input<typeof eliminarSesionInputSchema>;
