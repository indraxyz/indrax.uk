import posthog from "posthog-js"

import { POSTHOG_HOST } from "@/lib/analytics-host"
import { readConsent } from "@/lib/consent"

// Analytics is opt-in twice over. With no key configured - a fork, a preview
// build, a local run - nothing initialises and every capture below is a no-op.
// And with a key configured, nothing initialises until the visitor has said yes:
// see `lib/consent.ts` and `startAnalytics` below.
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY

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
const REDACTED_PARAMS = ["token", "preview"]

function redactUrl(value: unknown): unknown {
  if (typeof value !== "string") return value

  try {
    const url = new URL(value)
    let touched = false

    for (const param of REDACTED_PARAMS) {
      if (url.searchParams.has(param)) {
        url.searchParams.set(param, "redacted")
        touched = true
      }
    }

    return touched ? url.toString() : value
  } catch {
    return value
  }
}

export type ContactChannel = "email" | "linkedin" | "github"

let started = false

/**
 * Start the tracker, if there is a key and the visitor has agreed.
 *
 * The consent check is here rather than at the call site so that there is one
 * place it can be got wrong, and that place is the one that owns the cookie.
 * Nothing is written and nothing is sent before this returns.
 */
export function startAnalytics() {
  if (!POSTHOG_KEY || started) return
  if (readConsent() !== "granted") return

  started = true

  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      // Opts into PostHog's current defaults - pageview and pageleave capture
      // among them - rather than pinning behaviour this file would have to track.
      defaults: "2025-05-24",
      // Nobody signs in here, so there is no person to profile and no reason to
      // store one. Visitors stay anonymous.
      person_profiles: "identified_only",
      respect_dnt: true,
      // There are no feature flags, experiments or surveys on a static resume, so
      // the flag request PostHog would otherwise make on every load is pure latency.
      advanced_disable_flags: true,
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
            event.properties[key] = redactUrl(value)
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
 * Withdrawing consent has to undo the thing consent allowed, not merely stop
 * adding to it: `opt_out_capturing` ends the session and clears the cookies and
 * stored identifiers PostHog set. `started` is reset so a later re-grant starts
 * cleanly rather than assuming an initialised client.
 */
export function stopAnalytics() {
  if (!started) return

  try {
    posthog.opt_out_capturing()
    posthog.reset()
  } catch (error) {
    console.error("Analytics failed to stop", error)
  } finally {
    started = false
  }
}
