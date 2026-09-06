import posthog from "posthog-js"

// Analytics is opt-in. With no key configured - a fork, a preview build, a local
// run - nothing initialises and every capture below is a no-op, so the site
// behaves identically whether or not it is being measured.
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com"

// The events this site records. A union rather than a bare string, so a typo in a
// call site is a build error instead of a silently orphaned event in PostHog.
type AnalyticsEvent = "resume_pdf_downloaded" | "contact_clicked"

export type ContactChannel = "email" | "linkedin" | "github"

let started = false

export function startAnalytics() {
  if (!POSTHOG_KEY || started) return
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
