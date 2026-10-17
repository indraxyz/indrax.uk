import { afterEach, expect, it, vi } from "vitest"

const { environment } = vi.hoisted(() => ({ environment: {} as Record<string, string> }))
vi.mock("vite", () => ({ loadEnv: () => environment }))
vi.mock("./site-updated-at.ts", () => ({ resolveSiteUpdatedAt: () => "2026-10-14" }))

import { publicEnvDefinitions } from "./public-env"

afterEach(() => {
  for (const key of Object.keys(environment)) delete environment[key]
  vi.unstubAllEnvs()
})

it("never exposes project tokens or arbitrary environment variables", () => {
  Object.assign(environment, {
    POSTHOG_KEY: "phc_previously_exposed",
    POSTHOG_HOST: "https://us.i.posthog.com",
    ACCIDENTAL_SECRET: "private",
    POSTHOG_PROJECT_TOKEN: "phc_runtime_only",
    ANALYTICS_ENABLED: "true",
  })
  const definitions = publicEnvDefinitions("production")
  expect(definitions["process.env.ANALYTICS_ENABLED"]).toBe('"true"')
  expect(JSON.stringify(definitions)).not.toContain("phc_")
  expect(JSON.stringify(definitions)).not.toContain("private")
  expect(definitions).not.toHaveProperty("process.env.POSTHOG_KEY")
})

it("keeps analytics disabled by default and preserves explicit site origins", () => {
  environment.SITE_URL = "https://dev.indrax.uk"
  const definitions = publicEnvDefinitions("production")
  expect(definitions["process.env.ANALYTICS_ENABLED"]).toBe('"false"')
  expect(definitions["process.env.SITE_URL"]).toBe('"https://dev.indrax.uk"')
})

it("normalizes the public enable flag rather than embedding an accidental credential", () => {
  environment.ANALYTICS_ENABLED = "phc_wrong_setting"
  const definitions = publicEnvDefinitions("production")
  expect(definitions["process.env.ANALYTICS_ENABLED"]).toBe('"false"')
  expect(JSON.stringify(definitions)).not.toContain("phc_wrong_setting")
})

it.each([
  ["", "https://media.indrax.uk"],
  ["dev", "https://dev-media.indrax.uk"],
])("uses the matching R2 origin when CI's media setting is empty: %s", (env, origin) => {
  vi.stubEnv("CLOUDFLARE_ENV", env)
  environment.MEDIA_ORIGIN = ""
  expect(publicEnvDefinitions("production")["process.env.MEDIA_ORIGIN"]).toBe(
    JSON.stringify(origin)
  )
})

it("preserves an explicit media-origin override", () => {
  environment.MEDIA_ORIGIN = "https://media.example.com"
  expect(publicEnvDefinitions("production")["process.env.MEDIA_ORIGIN"]).toBe(
    JSON.stringify("https://media.example.com")
  )
})

it.each([
  ["", "https://media.indrax.uk"],
  ["dev", "https://dev-media.indrax.uk"],
])("does not embed the local media route in production builds: %s", (env, origin) => {
  vi.stubEnv("CLOUDFLARE_ENV", env)
  environment.MEDIA_ORIGIN = "http://localhost:5173/local-media"
  expect(publicEnvDefinitions("production")["process.env.MEDIA_ORIGIN"]).toBe(
    JSON.stringify(origin)
  )
  expect(publicEnvDefinitions("development")["process.env.MEDIA_ORIGIN"]).toBe(
    JSON.stringify("http://localhost:5173/local-media")
  )
})

it("defaults to Worker transport without embedding public or runtime project keys", () => {
  environment.POSTHOG_PUBLIC_KEY = "phc_unused"
  environment.POSTHOG_PROJECT_TOKEN = "phc_runtime_secret"
  const definitions = publicEnvDefinitions("production")
  expect(definitions["process.env.ANALYTICS_TRANSPORT"]).toBe('"worker"')
  expect(definitions["process.env.POSTHOG_PUBLIC_KEY"]).toBe('""')
  expect(JSON.stringify(definitions)).not.toContain("phc_")
})

it("embeds direct transport's explicitly public key and normalizes its regional host", () => {
  Object.assign(environment, {
    ANALYTICS_ENABLED: "true",
    ANALYTICS_TRANSPORT: "direct",
    POSTHOG_PUBLIC_KEY: " phc_public_fixture ",
    POSTHOG_PUBLIC_HOST: " https://eu.i.posthog.com/ ",
    POSTHOG_PROJECT_TOKEN: "phc_runtime_secret",
  })
  const definitions = publicEnvDefinitions("production")
  expect(definitions["process.env.POSTHOG_PUBLIC_KEY"]).toBe('"phc_public_fixture"')
  expect(definitions["process.env.POSTHOG_PUBLIC_HOST"]).toBe('"https://eu.i.posthog.com"')
  expect(JSON.stringify(definitions)).not.toContain("phc_runtime_secret")
})

it.each(["proxy", " direct "])("refuses unsupported transport values: %s", (transport) => {
  environment.ANALYTICS_TRANSPORT = transport
  expect(() => publicEnvDefinitions("production")).toThrow("ANALYTICS_TRANSPORT")
})

it.each(["", "phx_personal_key"])(
  "requires a public project key for enabled direct tracking: %s",
  (key) => {
    Object.assign(environment, {
      ANALYTICS_TRANSPORT: "direct",
      ANALYTICS_ENABLED: "true",
      POSTHOG_PUBLIC_KEY: key,
    })
    expect(() => publicEnvDefinitions("production")).toThrow("POSTHOG_PUBLIC_KEY")
  }
)

it("rejects direct hosts outside the CSP regional allowlist", () => {
  Object.assign(environment, {
    ANALYTICS_TRANSPORT: "direct",
    POSTHOG_PUBLIC_HOST: "https://untrusted.example",
  })
  expect(() => publicEnvDefinitions("production")).toThrow("POSTHOG_PUBLIC_HOST")
})

it("allows analytics to stay disabled in direct mode without a key", () => {
  environment.ANALYTICS_TRANSPORT = "direct"
  const definitions = publicEnvDefinitions("production")
  expect(definitions["process.env.ANALYTICS_ENABLED"]).toBe('"false"')
  expect(definitions["process.env.POSTHOG_PUBLIC_KEY"]).toBe('""')
})
