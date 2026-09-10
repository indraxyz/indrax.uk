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

  /*
   * Two projects, split by whether a spec writes to the database.
   *
   * `fullyParallel` is right for specs that only read: they are independent and
   * the suite is much faster for it. It is wrong for the two that create, publish
   * and delete posts and mint sessions, because every other spec is reading the
   * same archive, feed and sitemap at the same time - and a spec that publishes a
   * post while another asserts on the feed's contents is a coin flip, not a test.
   *
   * So the writing specs run last, alone, and only once the reading ones are done.
   * `dependencies` enforces the ordering; `fullyParallel: false` keeps them from
   * racing each other.
   */
  projects: [
    {
      name: "reads",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [/admin-authoring\.spec\.ts/, /admin-session\.spec\.ts/],
    },
    {
      name: "writes",
      use: { ...devices["Desktop Chrome"] },
      testMatch: [/admin-authoring\.spec\.ts/, /admin-session\.spec\.ts/],
      fullyParallel: false,
      dependencies: ["reads"],
    },
  ],

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
      // Passed through when it is set, and absent otherwise - the site builds and
      // serves either way. `blog-content.spec.ts` skips itself when it is missing,
      // so the suite is green on a clone with no database.
      ...(process.env.DATABASE_URL ? { DATABASE_URL: process.env.DATABASE_URL } : {}),
      // Same again for the admin. `admin-authoring.spec.ts` mints a session
      // against these, and skips itself when they are absent.
      ...(process.env.BETTER_AUTH_SECRET
        ? {
            BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
            // Better Auth checks the request Origin against this before it will
            // sign anyone out. Pointed anywhere else, sign-out answers 403 and the
            // session quietly survives - which is a real failure worth catching,
            // not a quirk to configure around, so the suite gives it the truth.
            BETTER_AUTH_URL: E2E_BASE_URL,
            ALLOWED_GITHUB_ID: process.env.ALLOWED_GITHUB_ID ?? "",
            GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ?? "",
            GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ?? "",
          }
        : {}),
    },
  },
})
