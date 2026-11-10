export { crearHttpClient } from "./crear-http-client.js";
export type { HttpClient, OpcionesHttpClient, RespuestaBinaria } from "./crear-http-client.js";
export { autenticadorApiKey, autenticadorBearer } from "./autenticador.js";
export type { Autenticador, CredencialesToken } from "./autenticador.js";
export { segmentoRuta } from "./ruta.js";

export type { OpcionesReintentos } from "./reintentos.js";
export { dormirAbortable } from "./reintentos.js";
export { mapearErrorAbortExterno } from "./mapear-error.js";
