import { expect, test } from "@playwright/test"

import { recordAnalytics } from "./support/analytics"
import { SEEDED_POST_SLUG } from "./support/constants"
import { whenHydrated } from "./support/hydration"

const EMAIL = "indracahyae@gmail.com"

// A plain desktop Chrome string. Playwright's own user agent announces
// "HeadlessChrome", which PostHog treats as a bot and silently drops - see the note
// in `support/analytics.ts`.
test.use({
  userAgent:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
})

// The PDF is drawn in the browser by a renderer that is only fetched when the
// button is pressed, and it is a large one: 5-9s on an idle machine, and rather
// more with every worker in the suite doing something else at the time. The
// default 30s is close enough to that to fail on load rather than on a defect,
// so the tests that wait for the file get room. It buys nothing anywhere else.
const DOWNLOAD_TIMEOUT_MS = 90_000

test.describe("analytics", () => {
  test("records a pageview on arrival", async ({ page }) => {
    const analytics = await recordAnalytics(page)
    await page.goto("/")

    await expect.poll(() => analytics.captured("$pageview"), { timeout: 20_000 }).toBe(true)
  })

  test("records the CV download", async ({ page }) => {
    test.setTimeout(DOWNLOAD_TIMEOUT_MS)

    const analytics = await recordAnalytics(page)
    await page.goto("/")

    await whenHydrated(page)
    await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download resume as PDF" }).click(),
    ])

    await expect
      .poll(() => analytics.captured("resume_pdf_downloaded"), { timeout: 20_000 })
      .toBe(true)
  })

  test("records which contact channel was used", async ({ page }) => {
    const analytics = await recordAnalytics(page)
    await page.goto("/")

    await page
      .getByRole("navigation", { name: "Contact" })
      .getByRole("link", { name: `Email ${EMAIL}` })
      .click()

    await expect.poll(() => analytics.captured("contact_clicked"), { timeout: 20_000 }).toBe(true)
    expect(analytics.sent.join("\n")).toContain("email")
  })

  test("sends nothing when the visitor has asked not to be tracked", async ({ page }) => {
    test.setTimeout(DOWNLOAD_TIMEOUT_MS)

    const analytics = await recordAnalytics(page)

    // `respect_dnt: true` is the guard being exercised. The sibling guard - no
    // key configured at all - cannot be covered here, because `NEXT_PUBLIC_*`
    // values are inlined at build time and this suite runs one build.
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "doNotTrack", { get: () => "1" })
    })

    await page.goto("/")
    await whenHydrated(page)
    await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download resume as PDF" }).click(),
    ])

    expect(analytics.captured("resume_pdf_downloaded")).toBe(false)
  })

  test("a failing tracker does not break the page or the download", async ({ page }) => {
    test.setTimeout(DOWNLOAD_TIMEOUT_MS)

    // Every analytics request errors; the page still has to work.
    await page.route("**/posthog.e2e.invalid/**", (route) => route.abort())
    await page.goto("/")

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Indra")

    await whenHydrated(page)
    const download = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download resume as PDF" }).click(),
    ]).then(([event]) => event)

    expect(download.suggestedFilename()).toBe("Indra-Cahya-Edytya-Resume.pdf")
  })

  test("never sends a draft preview token to the tracker", async ({ page }) => {
    const analytics = await recordAnalytics(page)

    // PostHog's automatic pageview capture records the whole URL. A draft preview
    // carries its access token there, so without redaction every preview would
    // ship a live bearer credential to a third party and park it in an event store
    // - where anyone with read access could replay it inside its window and read
    // unpublished work. That is the outcome the token's signing and expiry exist to
    // prevent (threat T-4).
    const token = "a-token-that-must-not-be-transmitted"
    await page.goto(`/blog/${SEEDED_POST_SLUG}/preview?token=${token}`)

    await expect.poll(() => analytics.captured("$pageview"), { timeout: 20_000 }).toBe(true)

    const payloads = analytics.everything()
    expect(payloads).not.toContain(token)
    // Redacted rather than dropped, so the page is still countable.
    expect(payloads).toContain("redacted")
  })

  test.describe("consent", () => {
    test("sends nothing at all before a decision is made", async ({ page }) => {
      const analytics = await recordAnalytics(page, { consent: null })

      await page.goto("/")
      await expect(page.getByRole("region", { name: /analytics consent/i })).toBeVisible()

      // Not opted out after starting - never started. Nothing requested, and no
      // PostHog cookie written.
      await page.waitForTimeout(3000)
      expect(analytics.sent).toEqual([])
      expect((await page.context().cookies()).filter((c) => c.name.startsWith("ph_"))).toEqual([])
    })

    test("still sends nothing after declining", async ({ page }) => {
      const analytics = await recordAnalytics(page, { consent: null })

      await page.goto("/")
      await page.getByRole("button", { name: "Decline" }).click()

      await expect(page.getByRole("region", { name: /analytics consent/i })).toHaveCount(0)
      await page.waitForTimeout(3000)
      expect(analytics.sent).toEqual([])
    })

    test("starts measuring as soon as consent is given, without a reload", async ({ page }) => {
      const analytics = await recordAnalytics(page, { consent: null })

      await page.goto("/")
      expect(analytics.sent).toEqual([])

      await page.getByRole("button", { name: "Accept" }).click()

      await expect.poll(() => analytics.captured("$pageview"), { timeout: 20_000 }).toBe(true)
    })

    test("remembers the answer, so it is asked once", async ({ page }) => {
      await recordAnalytics(page, { consent: null })

      await page.goto("/")
      await page.getByRole("button", { name: "Decline" }).click()
      await page.reload()

      await expect(page.getByRole("region", { name: /analytics consent/i })).toHaveCount(0)
    })

    test("never covers the footer it is asking in front of", async ({ page }) => {
      test.setTimeout(DOWNLOAD_TIMEOUT_MS)

      // The bar is fixed to the bottom of the viewport and the resume download
      // lives in the footer at the bottom of the page, so before the page
      // reserved the bar's height the notice sat directly on top of the site's
      // main call to action - unclickable for as long as the question went
      // unanswered.
      await recordAnalytics(page, { consent: null })
      await page.goto("/")

      await expect(page.getByRole("region", { name: /analytics consent/i })).toBeVisible()

      const button = page.getByRole("button", { name: "Download resume as PDF" })
      await button.scrollIntoViewIfNeeded()

      // Asked of the browser rather than of the coordinates: whatever is on top
      // at the middle of the button has to be the button.
      await expect
        .poll(() =>
          button.evaluate((element) => {
            const box = element.getBoundingClientRect()
            const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)

            return top !== null && element.contains(top)
          })
        )
        .toBe(true)

      // And it really is clickable, not merely uncovered.
      const [download] = await Promise.all([page.waitForEvent("download"), button.click()])
      expect(download.suggestedFilename()).toBe("Indra-Cahya-Edytya-Resume.pdf")
    })

    test("can be withdrawn from the footer, on any page", async ({ page }) => {
      await recordAnalytics(page, { consent: "granted" })

      for (const path of ["/", "/blog"]) {
        await test.step(path, async () => {
          await page.goto(path)

          // Withdrawing has to be as reachable as granting was.
          await page.getByRole("button", { name: "Cookies" }).click()
          await expect(page.getByRole("region", { name: /analytics consent/i })).toBeVisible()

          // Put it back for the next iteration.
          await page.getByRole("button", { name: "Accept" }).click()
        })
      }
    })
  })
})
