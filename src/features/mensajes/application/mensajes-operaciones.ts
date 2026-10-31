import type { HttpClient } from "../../../core/http-client/index.js";
import type { Resultado } from "../../../core/types/index.js";
import {
  confirmacionEnvioSchema,
  enviarLoteInputSchema,
  enviarMediaInputSchema,
  enviarPdfInputSchema,
  enviarTextoInputSchema,
  enviarUbicacionInputSchema,
  resultadoLoteSchema,
} from "../domain/mensajes-schemas.js";
import type {
  ConfirmacionEnvio,
  EnviarLoteInput,
  EnviarMediaInput,
  EnviarPdfInput,
  EnviarTextoInput,
  EnviarUbicacionInput,
  ResultadoLote,
} from "../domain/mensajes-schemas.js";
import { validarEntrada } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";

type Opciones = OpcionesOperacion | undefined;

type TipoMedia = "image" | "video" | "pdf" | "gif";

/**
 * Serializa un envío de media como multipart. `url` y `file` son mutuamente excluyentes
 * (ya validado). Un archivo en bytes se envuelve en un `Blob` con su `tipoContenido`, que la
 * API verifica contra los MIME permitidos.
 */
const construirFormularioMedia = (input: EnviarMediaInput | EnviarPdfInput): FormData => {
  const form = new FormData();
  form.append("phone", input.phone);
  if (input.url !== undefined) form.append("url", input.url);
  if (input.caption !== undefined) form.append("caption", input.caption);
  if ("fileName" in input && input.fileName !== undefined) {
    form.append("fileName", input.fileName);
  }
  if (input.file !== undefined) {
    if (input.file instanceof Blob) {
      form.append("file", input.file);
    } else {
      const blob = new Blob([new Uint8Array(input.file.bytes)], {
        type: input.file.tipoContenido,
      });
      form.append("file", blob, input.file.nombre ?? "archivo");
    }
  }
  return form;
};

const enviarMultipart = (
  http: HttpClient,
  tipo: TipoMedia,
  input: EnviarMediaInput | EnviarPdfInput,
  options: Opciones,
): Promise<Resultado<ConfirmacionEnvio>> =>
  http.post(`/v1/send/${tipo}`, construirFormularioMedia(input), {
    schemaRespuesta: confirmacionEnvioSchema,
    signal: options?.signal,
    timeout: options?.timeout,
  });

export const enviarTexto =
  (http: HttpClient) =>
  async (input: EnviarTextoInput, options?: Opciones): Promise<Resultado<ConfirmacionEnvio>> => {
    const valido = validarEntrada(enviarTextoInputSchema, input);
    if (!valido.success) return valido;
    return http.post("/v1/send/message", valido.data, {
      schemaRespuesta: confirmacionEnvioSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };

export const enviarUbicacion =
  (http: HttpClient) =>
  async (
    input: EnviarUbicacionInput,
    options?: Opciones,
  ): Promise<Resultado<ConfirmacionEnvio>> => {
    const valido = validarEntrada(enviarUbicacionInputSchema, input);
    if (!valido.success) return valido;
    return http.post("/v1/send/location", valido.data, {
      schemaRespuesta: confirmacionEnvioSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };

export const enviarLote =
  (http: HttpClient) =>
  async (input: EnviarLoteInput, options?: Opciones): Promise<Resultado<ResultadoLote>> => {
    const valido = validarEntrada(enviarLoteInputSchema, input);
    if (!valido.success) return valido;
    return http.post("/v1/send/batch", valido.data, {
      schemaRespuesta: resultadoLoteSchema,
      signal: options?.signal,
      timeout: options?.timeout,
    });
  };

/** Imagen, video y gif comparten input: solo cambia el endpoint. */
export const enviarMedia =
  (http: HttpClient, tipo: Exclude<TipoMedia, "pdf">) =>
  async (input: EnviarMediaInput, options?: Opciones): Promise<Resultado<ConfirmacionEnvio>> => {
    const valido = validarEntrada(enviarMediaInputSchema, input);
    return valido.success ? enviarMultipart(http, tipo, valido.data, options) : valido;
  };

export const enviarPdf =
  (http: HttpClient) =>
  async (input: EnviarPdfInput, options?: Opciones): Promise<Resultado<ConfirmacionEnvio>> => {
    const valido = validarEntrada(enviarPdfInputSchema, input);
    return valido.success ? enviarMultipart(http, "pdf", valido.data, options) : valido;
  };
