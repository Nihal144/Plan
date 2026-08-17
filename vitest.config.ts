import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Mirrors the `@/*` path alias in tsconfig.json, which Vitest does not read.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // PGlite boots a WASM Postgres per suite; the default 5s is too tight.
    testTimeout: 30_000,
  },
});
