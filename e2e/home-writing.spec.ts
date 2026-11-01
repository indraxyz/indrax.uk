import { expect, test, type Page } from "@playwright/test"

/**
 * The home page's recent-writing rail, against fixture API responses.
 *
 * Recent writing and the archive cards both load in the browser, so mocking their
 * APIs exercises the real layout without a seeded database.
 */
const posts = Array.from({ length: 9 }, (_, index) => ({
  id: `rail-${index}`,
  slug: `rail-fixture-${index}`,
  title: `Rail fixture ${index + 1}`,
  excerpt: "A recent article shown in the home page rail.",
  coverUrl: null,
  coverAlt: null,
  publishedAt: `2026-10-${String(10 + index).padStart(2, "0")}T00:00:00Z`,
  updatedAt: `2026-10-${String(10 + index).padStart(2, "0")}T00:00:00Z`,
  readingTime: 3,
  tags: [],
}))

async function mockWriting(page: Page) {
  const recentLimits: string[] = []
  await page.route("**/api/writing/recent**", (route) => {
    const limit = new URL(route.request().url()).searchParams.get("limit") ?? ""
    recentLimits.push(limit)
    return route.fulfill({ json: posts.slice(0, Number(limit)) })
  })
  await page.route("**/api/writing/posts**", (route) =>
    route.fulfill({ json: { posts, page: 1, pageCount: 1, total: posts.length } })
  )
  await page.route("**/api/writing/tags**", (route) => route.fulfill({ json: [] }))
  return recentLimits
}

const rail = (page: Page) => page.getByRole("region", { name: "Writing", exact: true })

test("disables both writing carousel arrows when the cards fit", async ({ page }) => {
  await mockWriting(page)
  await page.route("**/api/writing/recent**", (route) => route.fulfill({ json: posts.slice(0, 1) }))
  await page.goto("/")
  await expect(rail(page).locator("[data-print-columns] > *")).toHaveCount(1)
  const next = page.getByRole("button", { name: "Next Writing cards" })
  await expect(next).toBeVisible()
  await expect(next).toBeDisabled()
  await expect(page.getByRole("button", { name: "Previous Writing cards" })).toBeDisabled()
})

for (const width of [390, 768, 1440])
  test(`keeps grid-width cards in a full-bleed, scrollable rail at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const recentLimits = await mockWriting(page)

    await page.goto("/writing")
    const gridCard = page.locator("[data-post-grid] > *").first()
    await expect(gridCard).toBeVisible()
    const gridCardWidth = (await gridCard.boundingBox())!.width

    await page.goto("/")
    const region = rail(page)
    const cards = region.locator("[data-print-columns] > *")
    await expect(cards).toHaveCount(9)
    expect(recentLimits).toContain("9")

    // Each card keeps the width it had as a column of the archive grid.
    for (const card of [cards.first(), cards.last()])
      expect(
        Math.abs(
          (await card.evaluate((node) => node.getBoundingClientRect().width)) - gridCardWidth
        )
      ).toBeLessThanOrEqual(1)

    // The rail reaches both page edges and scrolls inside itself, never the page.
    const viewport = await page.evaluate(() => document.documentElement.clientWidth)
    const bounds = (await region.boundingBox())!
    expect(Math.abs(bounds.x)).toBeLessThanOrEqual(1)
    expect(Math.abs(bounds.width - viewport)).toBeLessThanOrEqual(1)
    expect(await region.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport
    )
  })

test("lets the keyboard reach and scroll the rail and its articles", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await mockWriting(page)
  await page.goto("/")
  const region = rail(page)
  await expect(region.locator("[data-print-columns] > *")).toHaveCount(9)
  await expect(region).toHaveAttribute("tabindex", "0")

  const firstCard = region.locator("[data-print-columns] > *").first()
  const initialLeft = (await firstCard.boundingBox())!.x
  await region.focus()
  await page.keyboard.press("ArrowRight")
  await expect.poll(async () => (await firstCard.boundingBox())!.x).toBeLessThan(initialLeft)

  // Tabbing to an off-screen article brings it into view.
  const last = region.getByRole("link", { name: "Rail fixture 9", exact: true })
  await region.focus()
  for (
    let index = 0;
    index < 30 && !(await last.evaluate((node) => node === document.activeElement));
    index++
  )
    await page.keyboard.press("Tab")
  await expect(last).toBeFocused()
  await expect(last).toBeInViewport()
  await expect(last).toHaveAttribute("href", "/writing/rail-fixture-8")
})
