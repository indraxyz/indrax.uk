/**
 * Whether the visitor has agreed to be measured.
 *
 * PostHog sets first-party cookies. For a `.uk` site with UK and EU visitors
 * those are not strictly-necessary cookies, so PECR and the GDPR want consent
 * *before* they are set - not an opt-out afterwards, and not a banner that
 * counts scrolling as agreement. The tier-1 spec recorded this as the one open
 * item that made the site non-compliant rather than merely imperfect.
 *
 * So the tracker does not initialise at all until this says yes. Not
 * initialised-then-opted-out: never started, so nothing is written and nothing
 * is sent.
 *
 * The decision itself lives in `localStorage`, not a cookie. Remembering what
 * someone chose is strictly necessary by definition - it exists only to honour
 * their choice - and keeping it out of a cookie means the site sets none at all
 * before consent, which is a simpler thing to be sure of than an exemption
 * argument.
 */
export const CONSENT_STORAGE_KEY = "indrax-analytics-consent"

/** Fired on the window when the decision changes, so listeners can react. */
export const CONSENT_CHANGE_EVENT = "indrax-analytics-consent-change"

export type ConsentDecision = "granted" | "denied"

/**
 * The stored decision, or null if none has been made.
 *
 * Every access is guarded: storage throws outright in some privacy modes, and a
 * consent helper that can throw would take the page with it.
 */
export function readConsent(): ConsentDecision | null {
  if (typeof window === "undefined") return null

  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY)

    return value === "granted" || value === "denied" ? value : null
  } catch {
    // Unreadable storage is treated as "no decision", which means no tracking.
    return null
  }
}

export function writeConsent(decision: ConsentDecision): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, decision)
  } catch {
    // If the choice cannot be stored it will be asked again next visit. That is
    // worse than remembering it and much better than tracking without it.
  }

  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: decision }))
}

/** Forget the decision, so the banner asks again. */
export function clearConsent(): void {
  try {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY)
  } catch {
    // Nothing to do; the caller has already stopped the tracker.
  }

  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: null }))
}
