import { gunzipSync, inflateSync } from "node:zlib"
import { readFile } from "node:fs/promises"
import { basename } from "node:path"
import { DatabaseSync } from "node:sqlite"

import type { Page, Request } from "@playwright/test"

import { ANALYTICS_GATEWAY_PATH, ANALYTICS_GATEWAY_TOKEN } from "../../lib/analytics-gateway"
import { handleAnalyticsGateway } from "../../lib/analytics-gateway.server"
import { runWithRequest } from "../../lib/runtime.server"
import { sqliteQuotaBinding } from "../../lib/analytics-gateway.test-support"

/**
 * PostHog does not send plain JSON. Depending on payload size and transport the
 * body arrives gzipped under a `text/plain` content type, form-encoded under
 * `data=`, base64-encoded, or raw - and a compressed body is binary, so
 * `postData()` returns nothing at all for it.
 *
 * These specs only ever ask "did we send this event name", so rather than model the
 * wire format, every plausible decoding is flattened into one searchable string.
 */
function readableBody(request: Request) {
  const parts = [request.url()]
  const buffer = request.postDataBuffer()

  if (!buffer) return parts.join("\n")

  const decoders = [
    () => buffer.toString("utf8"),
    () => gunzipSync(buffer).toString("utf8"),
    () => inflateSync(buffer).toString("utf8"),
  ]

  for (const decode of decoders) {
    let text: string
    try {
      text = decode()
    } catch {
      continue
    }
    parts.push(text)

    // A decoded body may still be wrapped: `data=<base64>` is PostHog's older
    // form-encoded shape.
    const payload = /(?:^|[?&])data=([^&]+)/.exec(text)?.[1] ?? text
    try {
      parts.push(Buffer.from(decodeURIComponent(payload), "base64").toString("utf8"))
    } catch {
      // Not base64; the decoded text above is already recorded.
    }
  }

  return parts.join("\n")
}

export interface RecordOptions {
  /**
   * The stored consent decision the page should start with.
   *
   * Defaults to `granted`, because most of these specs are about what the
   * tracker does once it is allowed to run. Pass `null` to start with no
   * decision made, which is what a first-time visitor has.
   */
  consent?: "granted" | "denied" | null
  /** Load the installed recorder against a synthetic remote configuration. */
  replay?: boolean
  /** Validate real SDK requests through the server handler and atomic SQLite quota. */
  validateGateway?: boolean
}

/**
 * Intercepts everything the page tries to send to PostHog and records it.
 *
 * Call before navigating.
 */
export async function recordAnalytics(page: Page, options: RecordOptions = {}) {
  const sent: string[] = []
  const forwarded: string[] = []
  let pendingGateway = Promise.resolve()
  const database = options.validateGateway ? new DatabaseSync(":memory:") : undefined
  if (database) {
    database.exec(await readFile("config/analytics-quota.sql", "utf8"))
    page.once("close", () => database.close())
  }
  const consent = options.consent === undefined ? "granted" : options.consent

  // Nothing initialises until this is set, so it has to be in place before the
  // first paint rather than after navigation.
  //
  // Seeded only, never cleared. An init script runs on every document, so
  // clearing here would also wipe a decision the test itself made and then
  // reloaded to check - `null` is the empty storage a fresh context already has.
  if (consent) {
    await page.addInitScript((value) => {
      window.localStorage.setItem("indrax-analytics-consent", value)
    }, consent)
  }

  // PostHog drops events from anything that looks automated - a `navigator.webdriver`
  // flag, or a "HeadlessChrome" entry in `userAgentData.brands` - and does so
  // silently, with no request and no log. That filter is on deliberately in
  // production, so rather than weaken the site's config for the tests, the test
  // browser stops advertising itself as automation. Paired with the plain Chrome
  // user agent the analytics spec sets.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false })
    Object.defineProperty(navigator, "userAgentData", { get: () => undefined })
  })

  await page.route(`**${ANALYTICS_GATEWAY_PATH}/**`, async (route) => {
    sent.push(readableBody(route.request()))

    const path = new URL(route.request().url()).pathname
    const script = path.endsWith(".js")
    const config = {
      hasFeatureFlags: true,
      // The SDK waits for an explicit server opt-in before automatic click capture.
      autocapture_opt_out: false,
      sessionRecording: options.replay
        ? { endpoint: "/s/", sampleRate: "1", minimumDurationMilliseconds: 0 }
        : false,
    }
    let body = script ? "/* No additional analytics scripts in browser tests. */" : '{"status":1}'
    if (path.endsWith("/config.js")) {
      body = `window._POSTHOG_REMOTE_CONFIG = window._POSTHOG_REMOTE_CONFIG || {}; window._POSTHOG_REMOTE_CONFIG[${JSON.stringify(ANALYTICS_GATEWAY_TOKEN)}] = ${JSON.stringify({ config })};`
    } else if (path.endsWith("/config")) body = JSON.stringify(config)
    else if (
      options.replay &&
      path.includes("/static/") &&
      /^(?:lazy-recorder|recorder|recorder-v2|posthog-recorder|rrweb-console-plugin)\.js$/.test(
        basename(path)
      )
    ) {
      body = await readFile(`node_modules/posthog-js/dist/${basename(path)}`, "utf8")
    }
    if (database) {
      const result = pendingGateway.then(async () => {
        const originalFetch = globalThis.fetch
        globalThis.fetch = async (input, init) => {
          const upstreamUrl = new URL(input instanceof Request ? input.url : String(input))
          if (init?.body) forwarded.push(String(init.body))
          if (upstreamUrl.pathname.endsWith("/config")) {
            return Response.json({
              hasFeatureFlags: true,
              autocapture_opt_out: false,
              sessionRecording: options.replay
                ? {
                    endpoint: "/s/",
                    sampleRate: "1",
                    minimumDurationMilliseconds: 0,
                  }
                : false,
            })
          }
          if (upstreamUrl.pathname.includes("/static/"))
            return new Response(body, { headers: { "Content-Type": "application/javascript" } })
          return Response.json({ status: 1 })
        }
        try {
          const browserRequest = route.request()
          const requestBody = browserRequest.postDataBuffer()
          const request = new Request(browserRequest.url(), {
            method: browserRequest.method(),
            headers: { ...browserRequest.headers(), "CF-Connecting-IP": "198.51.100.1" },
            ...(requestBody ? { body: Uint8Array.from(requestBody) } : {}),
          })
          const env = {
            POSTHOG_PROJECT_TOKEN: "phc_e2e_server_private",
            POSTHOG_HOST: "https://us.i.posthog.com",
            RATE_LIMIT_API: { limit: async () => ({ success: true }) },
            APP_D1: sqliteQuotaBinding(database),
          }
          return await runWithRequest(request, env, undefined, () =>
            handleAnalyticsGateway(request)
          )
        } finally {
          globalThis.fetch = originalFetch
        }
      })
      pendingGateway = result.then(
        () => undefined,
        () => undefined
      )
      const response = await result
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers),
        body: await response.text(),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: script ? "application/javascript" : "application/json",
      // The script and JSON transports expose the same synthetic project settings.
      body,
    })
  })

  return {
    sent,
    forwarded,
    captured: (event: string) => sent.some((body) => body.includes(event)),
    /** Everything sent, flattened - for asserting on what a payload must NOT hold. */
    everything: () => sent.join("\n"),
  }
}
