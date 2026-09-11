import type { Page } from "@playwright/test"

/**
 * Waits until React has attached its event listeners.
 *
 * The resume page is server-rendered, so every control is present, focusable and
 * clickable well before it does anything. Playwright's actionability checks are
 * satisfied by that markup - visible, stable, enabled, not covered - and will
 * happily click a button whose `onClick` does not exist yet. The click is then
 * silently lost: no error, no state change, and a `waitForEvent` that sits there
 * until the test times out.
 *
 * It only shows up under load, which is the worst way for it to show up. A CV
 * download that takes 6s idle took over 90s here, and the accessibility snapshot
 * is what gave it away - the button had focus from the click but was still in its
 * resting state, so the handler had never run.
 *
 * The consent UI is the signal, because it is the one thing on the page that
 * cannot be server-rendered: the decision lives in `localStorage`, so
 * `ConsentBanner` and `ConsentControl` both render `null` until an effect has
 * run. Exactly one of them is on the page once it has - the banner when no
 * decision has been made, the footer control when one has - so waiting for either
 * proves the effect fired, which proves hydration.
 */
export async function whenHydrated(page: Page) {
  await page
    .locator('[role="region"][aria-label="Analytics consent"], footer button:text-is("Cookies")')
    .first()
    .waitFor({ state: "attached" })
}
