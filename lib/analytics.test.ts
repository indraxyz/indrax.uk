import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ANALYTICS_GATEWAY_PATH, ANALYTICS_GATEWAY_TOKEN } from "./analytics-gateway"

const { tracker, consent } = vi.hoisted(() => ({
  tracker: {
    init: vi.fn(),
    capture: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    reset: vi.fn(),
    has_opted_out_capturing: vi.fn(() => false),
  },
  consent: { value: "granted" as string | null },
}))
vi.mock("posthog-js", () => ({ default: tracker }))
vi.mock("./consent", () => ({ readConsent: () => consent.value }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  consent.value = "granted"
  vi.stubEnv("ANALYTICS_ENABLED", "true")
  vi.stubGlobal("window", { location: new URL("https://indrax.uk/writing") })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it("does not initialize before consent or when disabled", async () => {
  consent.value = null
  const analytics = await import("./analytics")
  analytics.startAnalytics()
  expect(tracker.init).not.toHaveBeenCalled()
  vi.stubEnv("ANALYTICS_ENABLED", "false")
  vi.resetModules()
  consent.value = "granted"
  ;(await import("./analytics")).startAnalytics()
  expect(tracker.init).not.toHaveBeenCalled()
})

it("initializes only with a placeholder and routes SDK assets and events through this origin", async () => {
  vi.stubEnv("POSTHOG_PROJECT_TOKEN", "phc_runtime_secret")
  ;(await import("./analytics")).startAnalytics()
  expect(tracker.init).toHaveBeenCalledWith(
    ANALYTICS_GATEWAY_TOKEN,
    expect.objectContaining({
      api_host: `https://indrax.uk${ANALYTICS_GATEWAY_PATH}`,
      respect_dnt: true,
      disable_surveys: true,
    })
  )
  const options = tracker.init.mock.calls[0][1]
  expect(options).not.toHaveProperty("capture_heatmaps")
  for (const path of [
    "/static/recorder.js",
    `/array/${ANALYTICS_GATEWAY_TOKEN}/config.js`,
    "/s/",
    "/flags/",
  ]) {
    const rewritten = options.rewriteRequestPath(new URL(`https://us-assets.i.posthog.com${path}`))
    expect(rewritten.origin).toBe("https://indrax.uk")
    expect(rewritten.pathname).toBe(`${ANALYTICS_GATEWAY_PATH}${path}`)
  }
  const prefixed = new URL(`https://indrax.uk${ANALYTICS_GATEWAY_PATH}/e/`)
  expect(options.rewriteRequestPath(prefixed).pathname).toBe(prefixed.pathname)
  expect(JSON.stringify(tracker.init.mock.calls)).not.toContain("phc_runtime_secret")
})

it("retains custom events and stops capture on consent withdrawal", async () => {
  const analytics = await import("./analytics")
  analytics.startAnalytics()
  analytics.captureEvent("contact_clicked", { channel: "email" })
  expect(tracker.capture).toHaveBeenCalledWith("contact_clicked", { channel: "email" })
  analytics.stopAnalytics()
  expect(tracker.reset).toHaveBeenCalledOnce()
  analytics.captureEvent("resume_pdf_downloaded")
  expect(tracker.capture).toHaveBeenCalledTimes(1)
})

it("redacts preview credentials before sending SDK pageviews", async () => {
  ;(await import("./analytics")).startAnalytics()
  const beforeSend = tracker.init.mock.calls[0][1].before_send
  const event = beforeSend({
    properties: { $current_url: "https://indrax.uk/preview?token=bearer&preview=private" },
  })
  expect(JSON.stringify(event)).not.toContain("bearer")
  expect(JSON.stringify(event)).not.toContain("private")
  expect(event.properties.$current_url).toContain("redacted")
})

it("redacts heatmap URL keys before capture and merges colliding coordinate groups", async () => {
  ;(await import("./analytics")).startAnalytics()
  const beforeSend = tracker.init.mock.calls[0][1].before_send
  const click = { x: -0.5, y: 12.75, target_fixed: false, type: "click" }
  const move = { x: 8, y: 22, target_fixed: true, type: "mousemove" }
  const original = [click]
  const result = beforeSend({
    event: "$$heatmap",
    properties: {
      $heatmap_data: {
        "https://indrax.uk/preview?token=first-secret&code=oauth-first": original,
        "https://indrax.uk/preview?token=second-secret&code=oauth-second": [move],
      },
    },
  })
  expect(result.properties.$heatmap_data).toEqual({
    "https://indrax.uk/preview?token=redacted&code=redacted": [click, move],
  })
  expect(JSON.stringify(result)).not.toMatch(/first-secret|second-secret|oauth-first|oauth-second/)
  expect(original).toEqual([click])
})

it("redacts case-insensitive OAuth parameters and URL credentials in heatmap keys", async () => {
  ;(await import("./analytics")).startAnalytics()
  const beforeSend = tracker.init.mock.calls[0][1].before_send
  const point = { x: 1, y: 2, target_fixed: false, type: "click" }
  const result = beforeSend({
    event: "$$heatmap",
    properties: {
      $heatmap_data: {
        "https://user:password@indrax.uk/?Access_Token=private&refresh_token=refresh&id_token=id&campaign=summer":
          [point],
      },
    },
  })
  expect(Object.keys(result.properties.$heatmap_data)).toEqual([
    "https://indrax.uk/?Access_Token=redacted&refresh_token=redacted&id_token=redacted&campaign=summer",
  ])
})
