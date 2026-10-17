import { defineConfig, devices } from "@playwright/test"
import { E2E_BASE_URL, E2E_PORT } from "./e2e/support/constants"

const firefox = process.env.PLAYWRIGHT_BROWSER === "firefox"

// Development renders the critical CSS link that exposed the nonce mismatch.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "hydration.spec.ts",
  use: {
    ...devices[firefox ? "Desktop Firefox" : "Desktop Chrome"],
    ...(!firefox && process.env.PLAYWRIGHT_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHANNEL }
      : {}),
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx vite --configLoader native --port ${E2E_PORT} --strictPort`,
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      INDRAX_VITE_CACHE_DIR: process.env.INDRAX_VITE_CACHE_DIR ?? ".wrangler/hydration-vite-cache",
    },
  },
})
