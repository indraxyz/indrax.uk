import { defineConfig } from "vitest/config"

import unitConfig from "./vitest.config.mjs"

// No fallback to DATABASE_URL or .env.local: integration tests may only use an
// explicitly supplied local database. Their fixtures are removed by ID.
const url = process.env.TEST_DATABASE_URL
if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) {
  throw new Error("TEST_DATABASE_URL must point to an isolated localhost test database.")
}
process.env.DATABASE_URL = url

export default defineConfig({
  ...unitConfig,
  test: {
    ...unitConfig.test,
    include: ["test/integration/**/*.test.ts"],
    exclude: ["node_modules/**", "build/**", ".react-router/**", "e2e/**"],
    fileParallelism: false,
  },
})
