"use client"

import { useEffect } from "react"

import { startAnalytics, stopAnalytics } from "@/lib/analytics"
import { CONSENT_CHANGE_EVENT, readConsent } from "@/lib/consent"

/**
 * Starts and stops the tracker in step with the visitor's decision.
 *
 * Mounted once from the root layout. Starting inside an effect keeps it out of
 * the server render and off first paint; it renders nothing itself.
 *
 * It listens for the decision changing rather than only reading it on mount, so
 * accepting takes effect immediately and withdrawing stops tracking on the spot
 * - neither needs a reload, which is the difference between a consent control
 * that works and one that looks like it does.
 */
export function PostHogAnalytics() {
  useEffect(() => {
    const sync = () => {
      if (readConsent() === "granted") startAnalytics()
      else stopAnalytics()
    }

    sync()

    window.addEventListener(CONSENT_CHANGE_EVENT, sync)
    // Another tab is the same person making the same decision.
    window.addEventListener("storage", sync)

    return () => {
      window.removeEventListener(CONSENT_CHANGE_EVENT, sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  return null
}
