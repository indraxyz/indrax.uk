import { gunzipSync, inflateSync } from "node:zlib"

import type { Page, Request } from "@playwright/test"

import { E2E_POSTHOG_HOST } from "./constants"

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

/**
 * Intercepts everything the page tries to send to PostHog and records it.
 *
 * Call before navigating.
 */
export async function recordAnalytics(page: Page) {
  const sent: string[] = []

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

  await page.route(`${E2E_POSTHOG_HOST}/**`, async (route) => {
    sent.push(readableBody(route.request()))

    // The host does not resolve, so every request has to be answered here or the
    // library sits in a retry loop for the rest of the test.
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"status":1}',
    })
  })

  return {
    sent,
    captured: (event: string) => sent.some((body) => body.includes(event)),
  }
}
