import { expect, test } from "@playwright/test"

import { SEEDED_POST_SLUG, SEEDED_SERIES_SLUG, SEEDED_TAG_SLUG } from "./support/constants"

const pages = [
  { path: "/resume", current: "Resume" },
  { path: "/tech-stack", current: "Stack" },
  { path: "/writing", current: "Writing" },
  { path: "/writing/search?q=postgres", current: "Search", parent: true },
  { path: "/writing/no-such-article", current: "Not found" },
]

test("public breadcrumbs expose the current page and navigate to ancestors", async ({ page }) => {
  for (const width of [320, 1600]) {
    await page.setViewportSize({ width, height: 900 })
    for (const { path, current, parent } of pages) {
      await page.goto(path)
      const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb", exact: true })
      await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText(current)
      await expect(breadcrumb.getByRole("link", { name: current, exact: true })).toHaveCount(0)
      if (parent) {
        await breadcrumb.getByRole("link", { name: "Writing", exact: true }).click()
        await expect(page).toHaveURL(/\/writing$/)
      }
      const home = breadcrumb.getByRole("link", { name: "Home", exact: true })
      await home.focus()
      await page.keyboard.press("Enter")
      await expect(page).toHaveURL(/\/$/)
      await expect(page.getByRole("navigation", { name: "Breadcrumb", exact: true })).toHaveCount(0)
    }
  }
})

test("article, tag and series breadcrumbs match their structured data", async ({ page }) => {
  test.skip(!process.env.DATABASE_URL, "needs seeded writing fixtures")
  await page.setViewportSize({ width: 320, height: 900 })
  for (const path of [
    `/writing/${SEEDED_POST_SLUG}`,
    `/writing/tags/${SEEDED_TAG_SLUG}`,
    `/writing/series/${SEEDED_SERIES_SLUG}`,
  ]) {
    await page.goto(path)
    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb", exact: true })
    // Script contents are excluded from Playwright's rendered-text matching.
    // Wait for the parsed JSON-LD, including breadcrumbs added after CSR data loads.
    await expect
      .poll(async () => {
        const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
        return blocks.filter((block) => JSON.parse(block)["@type"] === "BreadcrumbList").length
      })
      .toBe(1)
    const trail = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll(
        (scripts) =>
          scripts
            .map((script) => JSON.parse(script.textContent!))
            .find((data) => data["@type"] === "BreadcrumbList").itemListElement
      )
    await expect(breadcrumb.locator("li")).toHaveText(
      trail.map((item: { name: string }) => item.name)
    )
    expect(
      await breadcrumb.evaluate((element) => element.getBoundingClientRect().right)
    ).toBeLessThanOrEqual(320)
    await breadcrumb.getByRole("link", { name: "Writing", exact: true }).click()
    await expect(page).toHaveURL(/\/writing$/)
  }
})

test("sign-in breadcrumbs return to the public site", async ({ page }) => {
  test.skip(
    !process.env.BETTER_AUTH_SECRET || !process.env.GITHUB_CLIENT_ID,
    "needs auth configuration"
  )
  await page.goto("/admin/login")
  const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb", exact: true })
  await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText("Sign in")
  await breadcrumb.getByRole("link", { name: "Home", exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
})
