import { describe, expect, it } from "vitest";
import {
  TIPOS_EVENTO_WEBHOOK,
  clasificarEvento,
  eventoWebhookSchema,
} from "../../../src/features/notificaciones/index.js";
import { EVENTO_CONEXION_FIXTURE, EVENTO_MENSAJE_TEXTO_FIXTURE } from "../../helpers/fixtures.js";

const clasificar = (json: unknown) =>
  clasificarEvento(json, eventoWebhookSchema, TIPOS_EVENTO_WEBHOOK);

describe("clasificarEvento", () => {
  it("devuelve el evento conocido sin marca", () => {
    expect(clasificar(EVENTO_CONEXION_FIXTURE)).toEqual({
      ok: true,
      evento: EVENTO_CONEXION_FIXTURE,
    });
  });

  it("marca un type desconocido con conocido:false y conserva sus campos", () => {
    expect(clasificar({ type: "nuevo", extra: [1] })).toEqual({
      ok: true,
      evento: { type: "nuevo", extra: [1], conocido: false },
    });
  });

  describe("message con messageType nuevo (forward-compat)", () => {
    const conTipo = (messageType: string, content: unknown) => ({
      ...EVENTO_MENSAJE_TEXTO_FIXTURE,
      data: { ...EVENTO_MENSAJE_TEXTO_FIXTURE.data, messageType, content },
    });

    it("lo marca conocido:false conservando el content crudo, no es error", () => {
      const crudo = conTipo("poll", { question: "?" });

      expect(clasificar(crudo)).toEqual({ ok: true, evento: { ...crudo, conocido: false } });
    });

    it("un messageType conocido con content inválido sigue siendo error", () => {
      expect(clasificar(conTipo("text", {}))).toMatchObject({ ok: false });
    });

    it("si además faltan campos comunes del mensaje sigue siendo error", () => {
      const { messageId: _omitido, ...sinId } = EVENTO_MENSAJE_TEXTO_FIXTURE.data;
      const roto = {
        ...EVENTO_MENSAJE_TEXTO_FIXTURE,
        data: { ...sinId, messageType: "poll", content: 1 },
      };

      expect(clasificar(roto)).toMatchObject({ ok: false });
    });
  });

  it("rechaza un type conocido con forma inválida", () => {
    expect(clasificar({ ...EVENTO_CONEXION_FIXTURE, data: {} })).toMatchObject({ ok: false });
  });

  it.each([null, "x", [], { type: 3 }, {}])("rechaza %j (sin type string)", (json) => {
    expect(clasificar(json)).toMatchObject({ ok: false });
  });
});
