import { defineConfig, devices } from "@playwright/test"

const port = 3226
const baseURL = `http://127.0.0.1:${port}`

/** A separate build proves the direct transport without changing gateway fixtures. */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results-analytics-direct",
  testMatch: "analytics-direct.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run build && npm run start -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      ANALYTICS_ENABLED: "true",
      ANALYTICS_TRANSPORT: "direct",
      POSTHOG_PUBLIC_KEY: "phc_direct_fixture",
      POSTHOG_PUBLIC_HOST: "https://us.i.posthog.com",
    },
  },
})
