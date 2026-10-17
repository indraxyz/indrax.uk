import { expect, test } from "@playwright/test"

import { recordDirectAnalytics } from "./support/direct-analytics"
import { whenHydrated } from "./support/hydration"

// The production SDK deliberately suppresses automated browsers; exercise its normal visitor path.
test.use({
  userAgent:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
})

test("direct capture follows consent, withdrawal and regrant without Worker analytics requests", async ({
  page,
}) => {
  const analytics = await recordDirectAnalytics(page)
  await page.goto("/")
  await whenHydrated(page)
  const consent = page.getByRole("region", { name: /analytics consent/i })
  await expect(consent).toBeVisible()
  await page.waitForTimeout(1500)
  expect(analytics.requests).toEqual([])

  await consent.getByRole("button", { name: "Accept", exact: true }).click()
  await expect.poll(() => analytics.captured("$pageview"), { timeout: 20_000 }).toBe(true)
  await page.getByRole("button", { name: "Open about me" }).click()
  await expect.poll(() => analytics.captured("$autocapture"), { timeout: 20_000 }).toBe(true)
  expect(analytics.urls.some((url) => url.startsWith("https://us.i.posthog.com/"))).toBe(true)
  expect(analytics.everything().includes("phc_direct_fixture")).toBe(true)
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: "Cookie preferences" }).click()
  await expect(consent).toBeVisible()
  expect(
    (await page.context().cookies()).filter((cookie) => cookie.name.startsWith("ph_"))
  ).toEqual([])
  // The preferences click can already be queued before its handler withdraws consent.
  // Compare event timestamps, rather than arrival times of previously queued batches.
  const withdrawalFinished = await page.evaluate(() => Date.now())
  await page
    .getByRole("navigation", { name: "Site", exact: true })
    .getByRole("link", { name: "Resume", exact: true })
    .click()
  await expect(page).toHaveURL(/\/resume$/)
  await page.waitForTimeout(3500)
  expect(
    analytics.events
      .filter((event) => Date.parse(event.timestamp ?? "") > withdrawalFinished)
      .map((event) => event.event)
  ).toEqual([])
  expect(
    analytics.events.some((event) => String(event.properties?.$current_url).endsWith("/resume"))
  ).toBe(false)
  const beforeRegrant = analytics.events.length

  await consent.getByRole("button", { name: "Accept", exact: true }).click()
  await page
    .getByRole("navigation", { name: "Site", exact: true })
    .getByRole("link", { name: "Stack", exact: true })
    .click()
  await expect
    .poll(
      () => analytics.events.slice(beforeRegrant).some((event) => event.event === "$pageview"),
      { timeout: 20_000 }
    )
    .toBe(true)
  expect(analytics.gatewayRequests).toEqual([])
})

test("direct CSP permits installed remote replay and performance scripts", async ({ page }) => {
  const analytics = await recordDirectAnalytics(page, { remoteExtensions: true })
  const violations: string[] = []
  await page.exposeFunction("reportDirectCspViolation", (uri: string) => violations.push(uri))
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      if (event.blockedURI.includes("posthog.com")) {
        void (
          window as Window & { reportDirectCspViolation?: (uri: string) => Promise<void> }
        ).reportDirectCspViolation?.(event.blockedURI)
      }
    })
  })
  const response = await page.goto("/")
  const csp = response?.headers()["content-security-policy"]
  expect(csp).toContain("https://us.i.posthog.com")
  expect(csp).toContain("https://us-assets.i.posthog.com")
  await whenHydrated(page)
  // Include a signed relative link in the recorder's initial full DOM snapshot.
  // Its stable id proves that the test inspected replay containing this fixture.
  await page.evaluate(() => {
    const link = document.createElement("a")
    link.id = "direct-replay-signed-link"
    link.href = "/writing/fixture/preview?token=direct-replay-secret-marker"
    link.textContent = "Replay redaction fixture"
    document.body.appendChild(link)
  })
  await page
    .getByRole("region", { name: /analytics consent/i })
    .getByRole("button", { name: "Accept", exact: true })
    .click()
  await page.getByRole("button", { name: "Open about me" }).click()
  for (const event of ["$pageview", "$autocapture", "$snapshot", "$web_vitals"]) {
    await expect.poll(() => analytics.captured(event), { timeout: 25_000 }).toBe(true)
  }
  for (const script of [
    "/config.js",
    "/lazy-recorder.js",
    "/web-vitals-with-attribution.js",
    "/dead-clicks-autocapture.js",
  ]) {
    expect(
      analytics.urls.some((url) => new URL(url).pathname.endsWith(script)),
      script
    ).toBe(true)
  }
  await expect
    .poll(() => analytics.snapshotContains("direct-replay-signed-link"), { timeout: 25_000 })
    .toBe(true)
  expect(analytics.snapshotContains("token=redacted")).toBe(true)
  expect(analytics.everything().includes("direct-replay-secret-marker")).toBe(false)
  expect(violations).toEqual([])
  expect(analytics.gatewayRequests).toEqual([])
})
