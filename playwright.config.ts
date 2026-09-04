import { defineConfig, devices } from "@playwright/test"

import { E2E_BASE_URL, E2E_PORT, E2E_POSTHOG_HOST, E2E_POSTHOG_KEY } from "./e2e/support/constants"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: E2E_BASE_URL,
    trace: "on-first-retry",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    // The suite asserts on prerendered output - the PDF and the OG card are drawn
    // during the build, not on demand - so it runs against a production build
    // rather than `next dev`, where those routes behave differently.
    command: `npm run build && npm run start -- --port ${E2E_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_POSTHOG_KEY: E2E_POSTHOG_KEY,
      NEXT_PUBLIC_POSTHOG_HOST: E2E_POSTHOG_HOST,
    },
  },
})
