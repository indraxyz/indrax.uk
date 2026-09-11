"use client"

import { Cookie } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { controlClassNames } from "@/components/ui/variants"
import {
  CONSENT_CHANGE_EVENT,
  clearConsent,
  readConsent,
  writeConsent,
  type ConsentDecision,
} from "@/lib/consent"
import { cn } from "@/lib/utils"

/**
 * Asks before anything is measured.
 *
 * Three properties make this a consent control rather than a notice:
 *
 * - **Nothing is tracked until it is answered.** The tracker is not started and
 *   opted out; it is not started. Declining and ignoring produce the same state.
 * - **Refusing is exactly as easy as accepting.** Two buttons, same size, same
 *   prominence. A cookie wall with a grey "manage preferences" link is not
 *   consent freely given.
 * - **It can be withdrawn**, from the footer of every page, at any time.
 *
 * It renders nothing until mounted, because the decision lives in `localStorage`
 * and the server cannot know it - rendering the banner during SSR would flash it
 * at people who already answered.
 */
export function ConsentBanner() {
  const [decision, setDecision] = useState<ConsentDecision | null | undefined>(undefined)
  const [height, setHeight] = useState(0)
  const bar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sync = () => setDecision(readConsent())

    sync()
    window.addEventListener(CONSENT_CHANGE_EVENT, sync)

    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, sync)
  }, [])

  // The bar is fixed, so it is out of flow and sits on top of whatever the page
  // ends with - which here is the footer holding the resume download and the
  // control for withdrawing this very consent. Covering the site's main call to
  // action with the cookie notice is the failure mode every one of these banners
  // has, so the page grows by exactly the bar's height and the footer stays
  // reachable. Measured rather than hard-coded because the text wraps to two and
  // three lines as the viewport narrows.
  useEffect(() => {
    const element = bar.current

    if (!element) {
      setHeight(0)
      return
    }

    const measure = () => setHeight(element.offsetHeight)
    const observer = new ResizeObserver(measure)

    measure()
    observer.observe(element)

    return () => observer.disconnect()
  }, [decision])

  // `undefined` is "not yet read"; `null` is "read, and no decision made".
  if (decision !== null) return null

  return (
    <>
      {/* Reserves the space the fixed bar occupies. Presentational only. */}
      <div aria-hidden style={{ height }} className="print:hidden" />

      <div
        ref={bar}
        // A dialog would trap focus and demand an answer before the page could be
        // read. The page is readable either way, so this announces itself and
        // waits.
        role="region"
        aria-label="Analytics consent"
        className="fixed inset-x-0 bottom-0 z-[60] border-t-2 border-border bg-background/98 backdrop-blur print:hidden"
      >
        <div className="container mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-3 text-sm font-medium leading-relaxed text-foreground">
            <Cookie className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Analytics helps me see whether anyone reads this. It sets cookies, so it stays off
              unless you say yes. Nothing is measured either way until you choose.
            </span>
          </p>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => writeConsent("denied")}
              className={cn(controlClassNames, "px-4 py-2")}
            >
              Decline
            </button>
            <button
              type="button"
              onClick={() => writeConsent("granted")}
              className={cn(
                controlClassNames,
                "variant-tertiary bg-[var(--color-accent)] px-4 py-2 text-[var(--color-accent-foreground)]"
              )}
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * Reopens the question, from anywhere.
 *
 * Withdrawing has to be as reachable as granting was, or the consent was not
 * really revocable. Clearing the decision stops the tracker - `PostHogAnalytics`
 * listens for the same event - and brings the banner back so a different answer
 * can be given.
 */
export function ConsentControl({ className }: { className?: string }) {
  const [decided, setDecided] = useState(false)

  useEffect(() => {
    const sync = () => setDecided(readConsent() !== null)

    sync()
    window.addEventListener(CONSENT_CHANGE_EVENT, sync)

    return () => window.removeEventListener(CONSENT_CHANGE_EVENT, sync)
  }, [])

  // Hidden while the banner is already asking; two controls for one question is
  // just noise.
  if (!decided) return null

  return (
    <button
      type="button"
      onClick={clearConsent}
      className={cn(
        "text-sm font-black uppercase tracking-[0.14em] text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background print:hidden",
        className
      )}
    >
      Cookies
    </button>
  )
}
