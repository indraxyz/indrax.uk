import { expect, it, vi } from "vitest"
import { verifyAnalytics } from "./verify-analytics.mjs"

it.each(["dev", "production"])("checks live config transports in %s", async (target) => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ sessionRecording: {} }))
    .mockResolvedValueOnce(
      new Response('window._POSTHOG_REMOTE_CONFIG["phc_indrax_gateway"]={config:{}};', {
        headers: { "content-type": "text/javascript; charset=utf-8" },
      })
    )
  await verifyAnalytics(target, fetcher)
  const origin = target === "dev" ? "https://dev.indrax.uk" : "https://indrax.uk"
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(fetcher).toHaveBeenCalledWith(
    `${origin}/api/analytics/array/phc_indrax_gateway/config`,
    expect.objectContaining({ headers: { Referer: `${origin}/` }, redirect: "manual" })
  )
})

it.each([502, 503, 429, 302])("fails the smoke check on HTTP %s", async (status) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: false }, { status }))
  await expect(verifyAnalytics("production", fetcher)).rejects.toThrow(`HTTP ${status}`)
})

it("rejects a JSON error served as the SDK script", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({}))
    .mockResolvedValueOnce(Response.json({ ok: false }))
  await expect(verifyAnalytics("dev", fetcher)).rejects.toThrow("config.js failed")
})

it("refuses unknown targets before making a network request", async () => {
  const fetcher = vi.fn<typeof fetch>()
  await expect(verifyAnalytics("staging", fetcher)).rejects.toThrow("Choose dev or production")
  expect(fetcher).not.toHaveBeenCalled()
})

it.each([null, [], "invalid"])("rejects a non-object configuration: %j", async (config) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(config))
  await expect(verifyAnalytics("dev", fetcher)).rejects.toThrow("must be an object")
})

it("rejects JavaScript without the SDK configuration wrapper", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({}))
    .mockResolvedValueOnce(
      new Response("/* unavailable */", { headers: { "content-type": "text/javascript" } })
    )
  await expect(verifyAnalytics("dev", fetcher)).rejects.toThrow("missing SDK configuration")
})
