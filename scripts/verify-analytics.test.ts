import { afterEach, describe, expect, it, vi } from "vitest"
import { verifyAnalytics } from "./verify-analytics.mjs"

it.each(["dev", "production"])("checks live config transports in %s", async (target) => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(
      async () =>
        new Response("/* SDK asset */", { headers: { "content-type": "text/javascript" } })
    )
    .mockResolvedValueOnce(Response.json({ sessionRecording: {} }))
    .mockResolvedValueOnce(
      new Response('window._POSTHOG_REMOTE_CONFIG["phc_indrax_gateway"]={config:{}};', {
        headers: { "content-type": "text/javascript; charset=utf-8" },
      })
    )
  await verifyAnalytics(target, fetcher)
  const origin = target === "dev" ? "https://dev.indrax.uk" : "https://indrax.uk"
  expect(fetcher).toHaveBeenCalledTimes(5)
  expect(fetcher).toHaveBeenCalledWith(
    `${origin}/api/analytics/array/phc_indrax_gateway/config`,
    expect.objectContaining({ headers: { Referer: `${origin}/` }, redirect: "manual" })
  )
})

it("fails if a deployed SDK asset returns JSON", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({}))
    .mockResolvedValueOnce(
      new Response('window._POSTHOG_REMOTE_CONFIG["phc_indrax_gateway"]={config:{}};', {
        headers: { "content-type": "text/javascript" },
      })
    )
    .mockResolvedValueOnce(Response.json({ ok: false }, { status: 404 }))
  await expect(verifyAnalytics("dev", fetcher)).rejects.toThrow("web-vitals.js failed: HTTP 404")
})

it.each([502, 503, 429, 302])("fails the smoke check on HTTP %s", async (status) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: false }, { status }))
  await expect(verifyAnalytics("production", fetcher)).rejects.toThrow(`HTTP ${status}`)
  expect(fetcher).toHaveBeenCalledTimes(1)
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

describe("transport failures", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  function setup() {
    vi.useFakeTimers()
    vi.spyOn(console, "warn").mockImplementation(() => {})
    return vi.fn<typeof fetch>(async (url) =>
      String(url).endsWith("/config")
        ? Response.json({})
        : new Response('window._POSTHOG_REMOTE_CONFIG["phc_indrax_gateway"]={config:{}};', {
            headers: { "content-type": "text/javascript" },
          })
    )
  }

  it.each([
    new DOMException("The operation was aborted due to timeout", "TimeoutError"),
    new TypeError("fetch failed", { cause: { code: "ETIMEDOUT" } }),
    new TypeError("fetch failed", { cause: { code: "ECONNRESET" } }),
  ])("recovers from a transient transport failure: %s", async (error) => {
    const fetcher = setup().mockRejectedValueOnce(error)
    const result = verifyAnalytics("production", fetcher)
    await vi.runAllTimersAsync()
    await result
    expect(fetcher).toHaveBeenCalledTimes(6)
    expect(fetcher.mock.calls[0][0]).toBe(fetcher.mock.calls[1][0])
    expect(fetcher.mock.calls[0][1]?.signal).not.toBe(fetcher.mock.calls[1][1]?.signal)
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it("bounds persistent timeouts and identifies the endpoint", async () => {
    const fetcher = setup().mockRejectedValue(new DOMException("timeout", "TimeoutError"))
    const assertion = expect(verifyAnalytics("production", fetcher)).rejects.toThrow(
      "https://indrax.uk/api/analytics/array/phc_indrax_gateway/config failed on attempt 3: request timed out after 15000ms"
    )
    await vi.runAllTimersAsync()
    await assertion
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(console.warn).toHaveBeenCalledTimes(2)
  })

  it("aborts a stalled request with the configured timeout before retrying", async () => {
    const fetcher = setup()
    vi.useRealTimers()
    const timeout = AbortSignal.timeout.bind(AbortSignal)
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => timeout(10))
    fetcher.mockImplementationOnce(
      async (_, options) =>
        new Promise((_, reject) => {
          const signal = options!.signal!
          signal.addEventListener("abort", () => reject(signal.reason), { once: true })
        })
    )
    await verifyAnalytics("production", fetcher)
    expect(timeoutSpy).toHaveBeenCalledWith(15_000)
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(6)
  })

  it("preserves HTTP failures when response cleanup encounters a transport error", async () => {
    const response = new Response(
      new ReadableStream({
        cancel() {
          throw new TypeError("socket closed", { cause: { code: "UND_ERR_SOCKET" } })
        },
      }),
      { status: 429, headers: { "content-type": "application/json" } }
    )
    const fetcher = setup().mockResolvedValueOnce(response)
    await expect(verifyAnalytics("dev", fetcher)).rejects.toThrow("HTTP 429")
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(console.warn).not.toHaveBeenCalled()
  })

  it("retries a timeout while reading the configuration body", async () => {
    const fetcher = setup().mockResolvedValueOnce(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new DOMException("timeout", "TimeoutError"))
          },
        }),
        { headers: { "content-type": "application/json" } }
      )
    )
    const result = verifyAnalytics("dev", fetcher)
    await vi.runAllTimersAsync()
    await result
    expect(fetcher).toHaveBeenCalledTimes(6)
  })

  it("retries only the failed asset, without repeating successful configuration reads", async () => {
    const fetcher = setup()
    const successful = fetcher.getMockImplementation()!
    fetcher.mockImplementation(async (url, options) => {
      if (fetcher.mock.calls.length === 3)
        throw new TypeError("fetch failed", { cause: { code: "UND_ERR_SOCKET" } })
      return successful(url, options)
    })
    const result = verifyAnalytics("dev", fetcher)
    await vi.runAllTimersAsync()
    await result
    expect(fetcher).toHaveBeenCalledTimes(6)
    expect(String(fetcher.mock.calls[2][0])).toContain("web-vitals.js")
    expect(fetcher.mock.calls[3][0]).toBe(fetcher.mock.calls[2][0])
  })

  it.each([
    new TypeError("invalid request"),
    new TypeError("fetch failed", { cause: { code: "CERT_HAS_EXPIRED" } }),
  ])("does not retry unknown errors or invalid TLS: %s", async (error) => {
    const fetcher = setup().mockRejectedValue(error)
    await expect(verifyAnalytics("dev", fetcher)).rejects.toThrow("failed on attempt 1")
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(console.warn).not.toHaveBeenCalled()
  })
})
