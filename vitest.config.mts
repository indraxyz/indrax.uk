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
    exclude: ["node_modules/**", "build/**", ".react-router/**", "e2e/**", "test/integration/**"],
    environment: "node",
    maxWorkers: 4,
  },
  resolve: {
    alias: {
      "@": resolveFromRoot("."),
    },
  },
})
