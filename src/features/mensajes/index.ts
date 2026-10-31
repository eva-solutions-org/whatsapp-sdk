import type { HttpClient } from "../../core/http-client/index.js";
import {
  enviarLote,
  enviarMedia,
  enviarPdf,
  enviarTexto,
  enviarUbicacion,
} from "./application/mensajes-operaciones.js";

/**
 * Operaciones de mensajes (`POST /v1/send/*`). Las funciones retornan `Resultado<T>`.
 * Un envío que falla por timeout o red es de resultado ambiguo (el mensaje pudo salir): el SDK no
 * reintenta los POST. Media: `url` o `file` (exactamente uno). `file` es un `Blob`/`File` o `{ bytes, tipoContenido }`.
 */
export const crearFacadeMensajes = (http: HttpClient) => {
  return {
    /**
     * Si falla por timeout o red (503 "Tiempo de espera agotado" / "Error de red") el resultado es
     * AMBIGUO: el mensaje pudo haber salido. No se reintenta solo; verifica antes de reenviar.
     * Acepta `timeout` (ms) en las opciones: la API puede esperar hasta 15 s por la sesión.
     */
    enviarTexto: enviarTexto(http),
    /** Ver `enviarTexto`: un fallo por timeout/red es ambiguo (el mensaje pudo salir). */
    enviarImagen: enviarMedia(http, "image"),
    /** Ver `enviarTexto`: un fallo por timeout/red es ambiguo (el mensaje pudo salir). */
    enviarVideo: enviarMedia(http, "video"),
    /** Ver `enviarTexto`: un fallo por timeout/red es ambiguo (el mensaje pudo salir). */
    enviarGif: enviarMedia(http, "gif"),
    /** Ver `enviarTexto`: un fallo por timeout/red es ambiguo (el mensaje pudo salir). */
    enviarPdf: enviarPdf(http),
    /** Ver `enviarTexto`: un fallo por timeout/red es ambiguo (el mensaje pudo salir). */
    enviarUbicacion: enviarUbicacion(http),
    /**
     * Ver `enviarTexto`: un fallo por timeout/red es ambiguo; en un lote algunos mensajes pudieron
     * salir. Si el lote es grande sube `timeout` en las opciones.
     */
    enviarLote: enviarLote(http),
  };
};

export type FacadeMensajes = ReturnType<typeof crearFacadeMensajes>;

export type {
  ArchivoMediaBytes,
  ConfirmacionEnvio,
  EnviarLoteInput,
  EnviarMediaInput,
  EnviarPdfInput,
  EnviarTextoInput,
  EnviarUbicacionInput,
  ResultadoLote,
} from "./domain/mensajes-schemas.js";
