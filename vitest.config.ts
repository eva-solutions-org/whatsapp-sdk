import { defineConfig } from "vitest/config";

/**
 * Vitest config con `projects:` API (Vitest 3+).
 *
 * Pool `node` para todos los tests; convención de nombre `*.mock.test.ts` (fetch mockeado,
 * sin red) y `*.e2e.test.ts`.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          include: ["tests/**/*.{mock,e2e}.test.ts", "tests/**/*.{mock,e2e}.test.tsx"],
          environment: "node",
          globals: false,
        },
      },
    ],
  },
});
