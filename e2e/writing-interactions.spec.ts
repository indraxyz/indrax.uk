import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { SEEDED_POST_SLUG } from "./support/constants"

const tags = Array.from({ length: 5 }, (_, index) => ({
  id: `interaction-tag-${index}`,
  slug: `interaction-${index}`,
  name: `Interaction tag ${index + 1}`,
}))

const post = {
  id: "interactions",
  slug: "interactions",
  title: "Writing interactions fixture",
  excerpt: "A fixture for reading controls.",
  coverUrl: null,
  coverAlt: null,
  publishedAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-01T00:00:00Z",
  readingTime: 3,
  tags,
}

async function mockCards(page: Page, count = 5) {
  await page.route("**/api/writing/recent**", (route) =>
    route.fulfill({
      json: [
        { ...post, tags: tags.slice(0, count) },
        {
          ...post,
          id: "second",
          slug: "second",
          title: "Second fixture",
          tags: tags.slice(0, count),
        },
      ],
    })
  )
  await page.goto("/")
  return page.getByRole("region", { name: "Writing", exact: true })
}

for (const count of [0, 1, 2]) {
  test(`${count} writing tags need no disclosure`, async ({ page }) => {
    const writing = await mockCards(page, count)
    await expect(
      writing.getByRole("link", { name: "Writing interactions fixture", exact: true })
    ).toBeVisible()
    await expect(writing.getByRole("button", { name: /more tags/ })).toHaveCount(0)
    await expect(writing.getByRole("link", { name: /^Interaction tag/ })).toHaveCount(count * 2)
  })
}

test("card tag disclosures toggle independently above the stretched title link", async ({
  page,
}) => {
  const writing = await mockCards(page)
  const first = writing.getByRole("navigation", { name: "Tags for Writing interactions fixture" })
  const second = writing.getByRole("navigation", { name: "Tags for Second fixture" })
  const toggle = first.getByRole("button")
  await expect(toggle).toHaveAccessibleName("Show 3 more tags")
  await expect(toggle).toHaveText("+3")
  const tagHeight = await first
    .getByRole("link")
    .first()
    .evaluate((el) => el.getBoundingClientRect().height)
  expect(await toggle.evaluate((el) => el.getBoundingClientRect().height)).toBe(tagHeight)
  await expect(first.getByRole("link")).toHaveCount(2)
  await toggle.focus()
  await page.keyboard.press("Enter")
  await expect(toggle).toBeFocused()
  await expect(toggle).toHaveAttribute("aria-expanded", "true")
  await expect(toggle).toHaveText("")
  await expect(toggle.locator("svg")).toBeVisible()
  await expect(toggle).toHaveAccessibleName("Show fewer tags")
  expect(await toggle.evaluate((el) => el.getBoundingClientRect().height)).toBe(tagHeight)
  await expect(first.getByRole("link")).toHaveCount(5)
  await expect(second.getByRole("link")).toHaveCount(2)
  await expect(first.getByRole("link", { name: "Interaction tag 5" })).toHaveAttribute(
    "href",
    "/writing?tag=interaction-4"
  )
  await first.getByRole("button", { name: "Show fewer tags" }).click()
  await expect(first.getByRole("link")).toHaveCount(2)
  await expect(page).toHaveURL(/\/$/)
  // Pointer activation also needs to reach the control rather than the card overlay.
  await first.getByRole("button", { name: "Show 3 more tags" }).click()
  await expect(first.getByRole("link")).toHaveCount(5)
})

test("preview tags expand on mobile without sharing the signed URL", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.route("**/api/writing/preview/interactions?**", (route) =>
    route.fulfill({
      json: {
        post: { ...post, status: "draft", publishedAt: null, seriesContext: null },
        article: { headings: [], html: "<p>Preview body.</p>" },
      },
    })
  )
  await page.goto("/writing/interactions/preview?token=private-preview-fixture")
  const nav = page.getByRole("navigation", { name: "Article tags" })
  const toggle = nav.getByRole("button", { name: "Show 3 more tags" })
  await toggle.focus()
  await page.keyboard.press("Space")
  await expect(nav.getByRole("link")).toHaveCount(5)
  await page.keyboard.press("Space")
  await expect(nav.getByRole("link")).toHaveCount(2)
  await expect(page.getByRole("button", { name: "Copy article link" })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  const results = await new AxeBuilder({ page }).include("article").analyze()
  expect(
    results.violations.filter(({ impact }) => impact === "serious" || impact === "critical")
  ).toEqual([])
})

test.describe("published article sharing", () => {
  test.skip(!process.env.DATABASE_URL, "needs a seeded database for the public SSR article")

  test("copies the canonical article link without query or fragment", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => localStorage.setItem("copied-article", value),
        },
      })
    })
    await page.goto(`/writing/${SEEDED_POST_SLUG}?token=must-not-be-copied#article`)
    const canonical = await page.locator('head link[rel="canonical"]').getAttribute("href")
    await page.getByRole("button", { name: "Copy article link" }).click()
    await expect(page.getByRole("dialog", { name: "Link copied" })).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem("copied-article"))).toBe(canonical)
    await expect(
      page.getByRole("button", { name: "Copy article link" }).locator("svg")
    ).toHaveClass(/lucide-share-2/)
    await expect(page.locator("article").getByText("Link copied", { exact: true })).toHaveCount(0)
    await page.getByRole("dialog", { name: "Link copied" }).hover()
    await page.getByRole("button", { name: "Dismiss notification" }).click()
    await expect(page.getByRole("dialog", { name: "Link copied" })).toHaveCount(0)
  })

  test("announces clipboard failure without claiming success", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("Clipboard denied")
          },
        },
      })
    })
    await page.goto(`/writing/${SEEDED_POST_SLUG}`)
    await page.getByRole("button", { name: "Copy article link" }).click()
    await expect(page.getByRole("dialog", { name: /Could not copy/ })).toBeVisible()
    await expect(page.getByText("Link copied", { exact: true })).toHaveCount(0)
  })
})
