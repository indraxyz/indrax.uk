import { readFile } from "node:fs/promises"
import { basename } from "node:path"
import { gunzipSync, inflateSync } from "node:zlib"

import type { Page, Request } from "@playwright/test"

export const DIRECT_PROJECT_KEY = "phc_direct_fixture"

interface CapturedEvent {
  event: string
  timestamp?: string
  properties?: Record<string, unknown>
}

function decodedBody(request: Request): string {
  const body = request.postDataBuffer()
  if (!body) return ""
  // Try compressed encodings before UTF-8 so binary bytes never enter failure output.
  for (const decode of [
    () => gunzipSync(body).toString("utf8"),
    () => inflateSync(body).toString("utf8"),
    () => body.toString("utf8"),
  ]) {
    try {
      const decoded = decode()
      if (decoded.includes("\uFFFD")) continue
      const encoded = /(?:^|[?&])data=([^&]+)/.exec(decoded)?.[1]
      return encoded ? Buffer.from(decodeURIComponent(encoded), "base64").toString("utf8") : decoded
    } catch {
      // A payload only needs one of these wire-format decoders.
    }
  }
  return ""
}

/** Exercise the installed SDK while keeping every PostHog request local to the test. */
export async function recordDirectAnalytics(
  page: Page,
  { remoteExtensions = false }: { remoteExtensions?: boolean } = {}
) {
  const requests: string[] = []
  const urls: string[] = []
  const events: CapturedEvent[] = []
  const gatewayRequests: string[] = []
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/analytics/"))
      gatewayRequests.push(request.url())
  })
  // A transport regression must fail locally rather than reach a live gateway.
  await page.route("**/analytics/**", (route) => route.abort())
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false })
    Object.defineProperty(navigator, "userAgentData", { get: () => undefined })
  })
  await page.route(/^https:\/\/(?:[^/]+\.)?posthog\.com\//, async (route) => {
    const request = route.request()
    urls.push(request.url())
    const decoded = decodedBody(request)
    requests.push(decoded)
    try {
      const payload = JSON.parse(decoded)
      const batch = Array.isArray(payload) ? payload : (payload.batch ?? [payload])
      for (const event of batch) {
        if (typeof event.event === "string") events.push(event)
      }
    } catch {
      // Script, configuration and preflight requests have no event envelope.
    }
    const path = new URL(request.url()).pathname
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "*",
    }
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers })
      return
    }
    // The installed remote-config loader reads { [token]: { config } } from this global.
    const config = {
      hasFeatureFlags: true,
      autocapture_opt_out: false,
      sessionRecording: remoteExtensions
        ? { endpoint: "/s/", sampleRate: "1", minimumDurationMilliseconds: 0 }
        : false,
      ...(remoteExtensions
        ? { capturePerformance: { web_vitals: true }, captureDeadClicks: true }
        : {}),
    }
    let body = '{"status":1}'
    const script = path.endsWith(".js")
    if (path.endsWith("/config.js")) {
      body = `window._POSTHOG_REMOTE_CONFIG = window._POSTHOG_REMOTE_CONFIG || {}; window._POSTHOG_REMOTE_CONFIG[${JSON.stringify(DIRECT_PROJECT_KEY)}] = ${JSON.stringify({ config })};`
    } else if (path.endsWith("/config")) body = JSON.stringify(config)
    else if (script && path.includes("/static/")) {
      // Load actual extensions instead of stubs so CSP and SDK integration are exercised.
      if (
        /^(?:lazy-recorder|recorder|recorder-v2|posthog-recorder|rrweb-console-plugin|web-vitals|web-vitals-with-attribution|dead-clicks-autocapture)\.js$/.test(
          basename(path)
        )
      )
        body = await readFile(`node_modules/posthog-js/dist/${basename(path)}`, "utf8")
      else body = "/* Extension not enabled by this fixture. */"
    }
    await route.fulfill({
      status: 200,
      headers,
      contentType: script ? "application/javascript" : "application/json",
      body,
    })
  })
  return {
    requests,
    urls,
    events,
    gatewayRequests,
    captured: (name: string) => events.some((event) => event.event === name),
    snapshotContains: (value: string) =>
      events.some((event) => event.event === "$snapshot" && JSON.stringify(event).includes(value)),
    everything: () => requests.join("\n"),
  }
}
