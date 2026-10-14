import { defineConfig, devices } from "@playwright/test"
import { E2E_BASE_URL, E2E_PORT } from "./e2e/support/constants"

/** Local development uploads have a separate runtime from deployed artifacts. */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "local-uploads.spec.ts",
  outputDir: "test-results-uploads",
  workers: 1,
  reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: E2E_BASE_URL, trace: "retain-on-failure" },
  webServer: {
    command: "node scripts/local-upload-e2e-server.mjs",
    url: E2E_BASE_URL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      E2E_PORT: String(E2E_PORT),
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgres://indrax:indrax@127.0.0.1:4444/indrax?sslmode=require",
      BETTER_AUTH_SECRET: "local-upload-test-secret-00000000000000000000",
      BETTER_AUTH_URL: E2E_BASE_URL,
      ALLOWED_GITHUB_ID: "1",
      GITHUB_CLIENT_ID: "local-test",
      GITHUB_CLIENT_SECRET: "local-test",
      MEDIA_ORIGIN: `${E2E_BASE_URL}/local-media`,
      ANALYTICS_ENABLED: "false",
    },
  },
})
