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
    // PGlite boots a WASM Postgres per suite; the defaults (5s / 10s) are too
    // tight, and the migration setup runs in a hook rather than a test.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // One WASM Postgres at a time. Booting several in parallel makes each one
    // slow enough to trip the hook timeout on a cold run.
    fileParallelism: false,
  },
});
