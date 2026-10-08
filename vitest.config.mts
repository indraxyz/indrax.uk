import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

const resolveFromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/**
 * Fast Node tests cover logic and mocked framework/driver boundaries.
 * Real SQL and transaction checks run separately through
 * vitest.integration.config.mts; Playwright covers routes, authorization,
 * production rendering, and browser interactions.
 */
export default defineConfig({
  test: {
    // `.test.ts` here and `.spec.ts` in `e2e/`, so neither runner can pick up the
    // other's files whatever directory it is pointed at.
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "e2e/**", "test/integration/**"],
    environment: "node",
  },
  resolve: {
    alias: {
      // See test/support/server-only.ts for why this is safe.
      "server-only": resolveFromRoot("./test/support/server-only.ts"),
      "@": resolveFromRoot("."),
    },
  },
})
