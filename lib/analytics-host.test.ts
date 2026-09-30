import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * This constant is interpolated into a Content-Security-Policy, which is a
 * `;`-separated string. A value carrying a separator does not fail to match - it
 * rewrites the rest of the policy, and the browser reports nothing. So the
 * reduction to an origin is asserted rather than assumed.
 *
 * The module reads the environment once, at import, so each case needs a fresh
 * one - hence `resetModules` rather than a plain call.
 */
async function hostFor(value: string | undefined) {
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", value)
  vi.resetModules()

  return await import("./analytics-host")
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

const DEFAULT = "https://us.i.posthog.com"

describe("POSTHOG_HOST", () => {
  it("falls back when nothing is configured", async () => {
    expect((await hostFor(undefined)).POSTHOG_HOST).toBe(DEFAULT)
    expect((await hostFor("")).POSTHOG_HOST).toBe(DEFAULT)
  })

  it("keeps a configured origin", async () => {
    expect((await hostFor("https://eu.i.posthog.com")).POSTHOG_HOST).toBe(
      "https://eu.i.posthog.com"
    )
  })

  it("reduces a path and a trailing slash to the origin", async () => {
    // `connect-src https://host/ingest/` would only match that path prefix, so a
    // configured path is a silent mismatch rather than a stricter rule.
    expect((await hostFor("https://ph.example.com/ingest/")).POSTHOG_HOST).toBe(
      "https://ph.example.com"
    )
    expect((await hostFor("https://ph.example.com/")).POSTHOG_HOST).toBe("https://ph.example.com")
  })

  it("cannot be used to inject further directives", async () => {
    const { POSTHOG_HOST: injected } = await hostFor(
      "https://ph.example.com; script-src 'unsafe-eval'"
    )

    expect(injected).not.toContain(";")
    expect(injected).not.toContain("script-src")
  })

  it("cannot be used to break the directive with whitespace", async () => {
    expect((await hostFor("https://ph.example.com extra.example.com")).POSTHOG_HOST).toBe(DEFAULT)
  })

  it("refuses a scheme that is not http(s)", async () => {
    expect((await hostFor("javascript:alert(1)")).POSTHOG_HOST).toBe(DEFAULT)
    expect((await hostFor("data:text/plain,x")).POSTHOG_HOST).toBe(DEFAULT)
  })

  it("falls back on anything unparseable rather than throwing", async () => {
    // It runs inside next.config.ts; a typo in an optional variable must not
    // stop the build.
    expect((await hostFor("not a url")).POSTHOG_HOST).toBe(DEFAULT)
  })
})

describe("POSTHOG_ASSET_HOST", () => {
  it("matches the configured Cloud region", async () => {
    expect((await hostFor(undefined)).POSTHOG_ASSET_HOST).toBe("https://us-assets.i.posthog.com")
    expect((await hostFor("https://eu.i.posthog.com/")).POSTHOG_ASSET_HOST).toBe(
      "https://eu-assets.i.posthog.com"
    )
  })

  it("does not add an unrelated origin for a custom host", async () => {
    expect((await hostFor("https://ph.example.com")).POSTHOG_ASSET_HOST).toBeUndefined()
  })
})
