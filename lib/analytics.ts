import posthog from "posthog-js"

import { ANALYTICS_GATEWAY_PATH, ANALYTICS_GATEWAY_TOKEN } from "@/lib/analytics-gateway"
import { readConsent } from "@/lib/consent"

// Analytics is opt-in twice over. Without the public enable flag - a fork, a preview
// build, a local run - nothing initialises and every capture below is a no-op.
// And when enabled, nothing initialises until the visitor has said yes:
// see `lib/consent.ts` and `startAnalytics` below.
const ANALYTICS_ENABLED = process.env.ANALYTICS_ENABLED === "true"
const DIRECT_TRANSPORT = process.env.ANALYTICS_TRANSPORT === "direct"
// This explicitly public build setting is independent from the Worker's secret.
const PUBLIC_PROJECT_KEY = process.env.POSTHOG_PUBLIC_KEY?.trim() || ""
const PUBLIC_HOST = process.env.POSTHOG_PUBLIC_HOST || "https://us.i.posthog.com"

// The events this site records. A union rather than a bare string, so a typo in a
// call site is a build error instead of a silently orphaned event in PostHog.
type AnalyticsEvent = "resume_pdf_downloaded" | "contact_clicked"

/**
 * Query parameters that must never leave the browser.
 *
 * PostHog's automatic pageview capture records the full `$current_url`, and a
 * draft preview carries its access token there. Left alone, every preview would
 * ship a live bearer credential to a third party and park it in an event store
 * for the retention period - where anyone with read access could replay it inside
 * its window and read unpublished work. That is exactly the outcome the token's
 * expiry and signing exist to prevent (threat T-4).
 *
 * Stripped rather than the whole URL dropped, so the page a preview was viewed on
 * is still countable.
 */
const REDACTED_PARAMS = /^(?:token|preview|code|access_token|refresh_token|id_token)$/i

function redactUrl(value: unknown): unknown {
  if (typeof value !== "string") return value

  try {
    const url = new URL(value)
    let touched = false

    for (const param of [...url.searchParams.keys()]) {
      if (REDACTED_PARAMS.test(param)) {
        url.searchParams.set(param, "redacted")
        touched = true
      }
    }

    if (url.username || url.password) {
      url.username = ""
      url.password = ""
      touched = true
    }
    return touched ? url.toString() : value
  } catch {
    return value
  }
}

/** Heatmaps group coordinate arrays by full-page URL, including signed query values. */
function redactHeatmapUrls(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value
  const result: Record<string, unknown> = Object.create(null)
  for (const [url, points] of Object.entries(value)) {
    const key = String(redactUrl(url))
    const existing = result[key]
    if (Array.isArray(existing) && Array.isArray(points)) {
      for (const point of points) existing.push(point)
    } else {
      result[key] = Array.isArray(points) ? points.slice() : points
    }
  }
  return result
}

/** Replay contains nested DOM attributes, relative links and serialized markup. */
function redactNestedUrls(value: unknown, depth = 0, budget = { nodes: 0 }): unknown {
  if (++budget.nodes > 100_000 || depth > 128)
    throw new Error("Analytics data exceeds redaction limits")
  if (typeof value === "string")
    return String(redactUrl(value)).replace(
      /([?&](?:amp;)?(?:token|preview|code|access_token|refresh_token|id_token)=)[^&#\s"'<>]*/gi,
      "$1redacted"
    )
  if (Array.isArray(value)) return value.map((item) => redactNestedUrls(item, depth + 1, budget))
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        key === "$heatmap_data"
          ? redactHeatmapUrls(item)
          : redactNestedUrls(item, depth + 1, budget),
      ])
    )
  return value
}

export type ContactChannel = "email" | "linkedin" | "github"

let started = false
let initialized = false

/**
 * Start the tracker, if enabled and the visitor has agreed.
 *
 * The consent check is here rather than at the call site so that there is one
 * place it can be got wrong, and that place is the one that owns the cookie.
 * Nothing is written and nothing is sent before this returns.
 */
export function startAnalytics() {
  if (!ANALYTICS_ENABLED || started || (DIRECT_TRANSPORT && !PUBLIC_PROJECT_KEY)) return
  if (readConsent() !== "granted") return

  started = true

  try {
    if (initialized) {
      // init() is a no-op on an existing PostHog instance. Re-enable the
      // instance that was opted out when consent was withdrawn.
      posthog.opt_in_capturing({ captureEventName: false })
      return
    }

    // Worker mode uses a placeholder; only the gateway adds its runtime secret.
    // Direct mode requires its separate, explicitly public project key.
    posthog.init(DIRECT_TRANSPORT ? PUBLIC_PROJECT_KEY : ANALYTICS_GATEWAY_TOKEN, {
      ...(DIRECT_TRANSPORT
        ? { api_host: PUBLIC_HOST }
        : {
            api_host: `${window.location.origin}${ANALYTICS_GATEWAY_PATH}`,
            ui_host: window.location.origin,
            disable_compression: true,
            rewriteRequestPath: (url: URL) => {
              url.protocol = window.location.protocol
              url.host = window.location.host
              url.username = ""
              url.password = ""
              if (!url.pathname.startsWith(`${ANALYTICS_GATEWAY_PATH}/`))
                url.pathname = `${ANALYTICS_GATEWAY_PATH}${url.pathname}`
              return url
            },
          }),
      api_transport: "fetch",
      disable_surveys: true,
      // Redact nested replay URLs before transport compression in either mode.
      session_recording: { compress_events: false },
      // Enables history-change pageviews and pageleave capture. Keep this date
      // pinned: the guide's 2026-05-30 defaults tag localhost as an internal/test
      // host, hiding local visits when that dashboard filter is enabled.
      defaults: "2025-05-24",
      // Nobody signs in here, so there is no person to profile and no reason to
      // store one. Visitors stay anonymous.
      person_profiles: "identified_only",
      // Initial attribution also feeds /flags requests, outside before_send.
      // Avoid persisting the unfiltered landing URL of signed draft previews.
      save_referrer: false,
      save_campaign_params: false,
      respect_dnt: true,
      // Withdrawing consent must remove PostHog's persisted identifiers too.
      opt_out_persistence_by_default: true,
      // Runs on every event, including the automatic pageviews, before anything
      // is sent.
      before_send: (event) => {
        // Guarded rather than assumed. Not every event carries properties, and
        // `key in undefined` throws - which took PostHog down with it, and with it
        // every spec asserting the page logs no console errors. A hook that can
        // break the thing it filters is worse than no hook.
        if (!event?.properties) return event ?? null

        try {
          // Every property, rather than a list of the ones known to hold a URL.
          // The first attempt named `$current_url`, `$referrer` and `$pathname`
          // and still leaked, because PostHog also records `$session_entry_url` -
          // and the set grows with the library. Checking the value is a property
          // that stays true; checking the key is a list that goes stale.
          for (const [key, value] of Object.entries(event.properties)) {
            event.properties[key] =
              key === "$heatmap_data" ? redactHeatmapUrls(value) : redactNestedUrls(value)
          }
        } catch {
          // Redaction is a safety net, not a feature. If it cannot run, dropping
          // the event is the safe direction: better to lose a pageview than to
          // send a live token to a third party.
          return null
        }

        return event
      },
    })
    initialized = true

    // PostHog persists its own opt-out across reloads. If consent was withdrawn
    // in an earlier page load, init() reads that opt-out and suppresses captures
    // even though our consent store now says granted.
    if (posthog.has_opted_out_capturing()) {
      posthog.opt_in_capturing({ captureEventName: false })
    }
  } catch (error) {
    // Analytics is the least important thing on the page; it does not get to break
    // the render.
    console.error("Analytics failed to start", error)
    started = false
  }
}

export function captureEvent(
  name: AnalyticsEvent,
  properties?: Record<string, string | number | boolean>
) {
  if (!started) return

  try {
    posthog.capture(name, properties)
  } catch (error) {
    // A dropped event must never take the download or the mail client with it.
    console.error("Analytics capture failed", name, error)
  }
}

/**
 * Stop tracking and discard what the tracker stored.
 *
 * Withdrawing consent stops capture and clears stored identifiers. PostHog's
 * reset() clears its own consent state, so opt out again after resetting it.
 */
export function stopAnalytics() {
  if (!started) return

  try {
    posthog.opt_out_capturing()
    posthog.reset()
    posthog.opt_out_capturing()
  } catch (error) {
    console.error("Analytics failed to stop", error)
  } finally {
    started = false
  }
}
