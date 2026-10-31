import { defineConfig } from "tsdown";

/**
 * Build con tsdown.
 *
 * El artefacto es único para todos los entornos: la URL del servicio la define el
 * consumidor en runtime con `baseUrl`.
 *
 * Entries (un subpath por superficie): `index` (x-api-key), `webhooks`, `ws`,
 * `admin` (S2S) e `internal` (S2S). Única dependencia runtime: zod.
 */

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      webhooks: "src/webhooks.ts",
      ws: "src/ws.ts",
      admin: "src/admin.ts",
      internal: "src/internal.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2022",
    fixedExtension: false,
  },
]);
