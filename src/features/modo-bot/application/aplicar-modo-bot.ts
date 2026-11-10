import type { Resultado } from "../../../core/types/index.js";
import { telefonoSchema } from "../../../core/validacion/index.js";
import type { OpcionesOperacion } from "../../../core/validacion/index.js";
import type { FacadeChats } from "../../chats/index.js";
import { esTelefonoInterno } from "../../internal-chats/index.js";
import type { FacadeChatsInternos } from "../../internal-chats/index.js";
import type { FacadeMensajesInternos } from "../../internal-mensajes/index.js";
import type { ConfirmacionEnvio, FacadeMensajes } from "../../mensajes/index.js";
import type { ConfigModoBot } from "../domain/index.js";
import { crearNucleoModoBot } from "./nucleo-modo-bot.js";
import type { ContextoBot, CosturasModoBot, OpcionesEnvioBot } from "./nucleo-modo-bot.js";

type EnvioConBot =
  | "enviarTexto"
  | "enviarImagen"
  | "enviarVideo"
  | "enviarGif"
  | "enviarPdf"
  | "enviarUbicacion";

type ConOpcionesBot<F> = F extends (input: infer I, ...resto: never[]) => infer R
  ? (input: I, opciones?: OpcionesEnvioBot) => R
  : never;

/**
 * `FacadeMensajes` con las opciones de envío ampliadas (`messageIds`). `enviarLote` no cambia:
 * el modo bot no actúa sobre lotes.
 */
export type FacadeMensajesBot = {
  [K in keyof FacadeMensajes]: K extends EnvioConBot
    ? ConOpcionesBot<FacadeMensajes[K]>
    : FacadeMensajes[K];
};

const telefonoDe = (input: unknown): string | undefined => {
  const phone = (input as { phone?: unknown } | null)?.phone;
  return telefonoSchema.safeParse(phone).success ? (phone as string) : undefined;
};

/**
 * Envuelve los envíos individuales de `mensajes` con el comportamiento de un humano (verificar,
 * marcar leído, escribir, enviar; ver `crearNucleoModoBot`). Un input sin teléfono válido pasa
 * directo al envío, que responde el 422. `enviarLote` no se toca.
 */
export const aplicarModoBot = ({
  mensajes,
  chats,
  config,
  signal,
  costuras = {},
}: {
  mensajes: FacadeMensajes;
  chats: FacadeChats;
  config: ConfigModoBot;
  signal?: AbortSignal | undefined;
  costuras?: CosturasModoBot;
}): FacadeMensajesBot => {
  const { envolver } = crearNucleoModoBot({ config, signal, costuras });

  const contextoDe = (input: unknown): ContextoBot | undefined => {
    const phone = telefonoDe(input);
    if (phone === undefined) return undefined;
    return {
      phone,
      verificarExistencia: (opciones) => chats.verificarExistencia({ phone }, opciones),
      indicarEscritura: (segundos, opciones) =>
        chats.indicarEscritura({ phone, estado: "escribiendo", segundos }, opciones),
      marcarLeido: (messageIds, opciones) => chats.marcarLeido({ phone, messageIds }, opciones),
    };
  };
  const conModoBot = <I>(
    enviar: (input: I, opciones?: OpcionesOperacion) => Promise<Resultado<ConfirmacionEnvio>>,
    textoDe: (input: I) => string | undefined,
  ) => envolver(enviar, textoDe, contextoDe);

  return {
    ...mensajes,
    enviarTexto: conModoBot(mensajes.enviarTexto, (i) => i.message),
    enviarImagen: conModoBot(mensajes.enviarImagen, (i) => i.caption),
    enviarVideo: conModoBot(mensajes.enviarVideo, (i) => i.caption),
    enviarGif: conModoBot(mensajes.enviarGif, (i) => i.caption),
    enviarPdf: conModoBot(mensajes.enviarPdf, (i) => i.caption),
    enviarUbicacion: conModoBot(mensajes.enviarUbicacion, () => undefined),
  };
};

/**
 * Modo bot de la vía interna (`./internal`): envuelve `mensajes.enviar` (texto y media) con
 * verificar → escribir → enviar, con las llamadas de `chats` internos ligadas al `sourcePhone`
 * del envío. No marca leído (no existe en la vía interna) y el tipo no expone `messageIds`.
 * Un input cuyo `phone` no pasa el schema estricto del público (7 a 15 dígitos, sin `+`) o cuyo
 * `sourcePhone` es inválido pasa directo al envío, que responde como en modo humano. Las consultas
 * en vuelo se separan por remitente; la caché de resultados es por destino.
 */
export const aplicarModoBotInterno = ({
  mensajes,
  chats,
  config,
  signal,
  costuras = {},
}: {
  mensajes: FacadeMensajesInternos;
  chats: FacadeChatsInternos;
  config: ConfigModoBot;
  signal?: AbortSignal | undefined;
  costuras?: CosturasModoBot;
}): FacadeMensajesInternos => {
  const { envolver } = crearNucleoModoBot({ config, signal, costuras });

  return {
    ...mensajes,
    enviar: envolver(
      mensajes.enviar,
      (i) => ("message" in i ? i.message : i.caption),
      (input) => {
        // Acceso seguro: un input nulo debe llegar al envío, que responde el 422 local.
        const { phone, sourcePhone } = (input ?? {}) as { phone?: unknown; sourcePhone?: unknown };
        // Mismo criterio que el público: un destino que no pasa el schema estricto va directo al
        // envío y responde lo mismo que en modo humano (sin pasos de bot).
        const destino = telefonoDe({ phone });
        if (destino === undefined || !esTelefonoInterno(sourcePhone)) return undefined;
        return {
          phone: destino,
          claveConsulta: `${sourcePhone}:${destino}`,
          verificarExistencia: (opciones) =>
            chats.verificarExistencia({ phone: destino, sourcePhone }, opciones),
          indicarEscritura: (segundos, opciones) =>
            chats.indicarEscritura(
              { phone: destino, sourcePhone, estado: "escribiendo", segundos },
              opciones,
            ),
        };
      },
    ),
  };
};
