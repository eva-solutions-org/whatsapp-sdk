/**
 * Error de programación al configurar el SDK (apiKey, baseUrl, secreto S2S o timeout
 * inválidos). Se lanza de forma síncrona al crear un cliente.
 *
 * Es la ÚNICA excepción que el SDK lanza fuera de iteradores y del cliente WebSocket:
 * los flujos de negocio (HTTP, validación, parseo) siempre retornan `Resultado<T>`.
 *
 * Los mensajes NUNCA repiten el valor recibido (puede ser una credencial).
 */
export class ErrorConfiguracion extends Error {
  constructor(mensaje: string) {
    super(`[whatsapp-sdk] ${mensaje}`);
    this.name = "ErrorConfiguracion";
  }
}
