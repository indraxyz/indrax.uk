import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

const resolveFromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/**
 * Unit tests for the pure logic.
 *
 * Playwright covers behaviour through a real build and a real browser, which is
 * the right instrument for routes, rendering and the auth boundary. It is a
 * blunt one for a function that takes a string and returns a string: proving
 * that `slugify` handles a doubled hyphen should not need a production build and
 * a Chromium process.
 *
 * So the split is by what is under test, not by layer. Anything that is a pure
 * function of its input lives here; anything needing a request, a database or a
 * DOM stays in `e2e/`.
 */
export default defineConfig({
  test: {
    // `.test.ts` here and `.spec.ts` in `e2e/`, so neither runner can pick up the
    // other's files whatever directory it is pointed at.
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
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
