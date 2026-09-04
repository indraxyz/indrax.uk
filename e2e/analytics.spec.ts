import { expect, test } from "@playwright/test"

import { recordAnalytics } from "./support/analytics"

const EMAIL = "indracahyae@gmail.com"

// A plain desktop Chrome string. Playwright's own user agent announces
// "HeadlessChrome", which PostHog treats as a bot and silently drops - see the note
// in `support/analytics.ts`.
test.use({
  userAgent:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
})

test.describe("analytics", () => {
  test("records a pageview on arrival", async ({ page }) => {
    const analytics = await recordAnalytics(page)
    await page.goto("/")

    await expect.poll(() => analytics.captured("$pageview"), { timeout: 20_000 }).toBe(true)
  })

  test("records the CV download", async ({ page }) => {
    const analytics = await recordAnalytics(page)
    await page.goto("/")

    await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Download resume as PDF" }).click(),
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
    const analytics = await recordAnalytics(page)

    // `respect_dnt: true` is the guard being exercised. The sibling guard - no
    // key configured at all - cannot be covered here, because `NEXT_PUBLIC_*`
    // values are inlined at build time and this suite runs one build.
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "doNotTrack", { get: () => "1" })
    })

    await page.goto("/")
    await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Download resume as PDF" }).click(),
    ])

    expect(analytics.captured("resume_pdf_downloaded")).toBe(false)
  })

  test("a failing tracker does not break the page or the download", async ({ page }) => {
    // Every analytics request errors; the page still has to work.
    await page.route("**/posthog.e2e.invalid/**", (route) => route.abort())
    await page.goto("/")

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Indra")

    const download = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Download resume as PDF" }).click(),
    ]).then(([event]) => event)

    expect(download.suggestedFilename()).toBe("Indra-Cahya-Edytya-Resume.pdf")
  })
})
