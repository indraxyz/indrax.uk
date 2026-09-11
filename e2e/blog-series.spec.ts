import { expect, test } from "@playwright/test"

import {
  SEEDED_DRAFT_SLUG,
  SEEDED_DRAFT_TITLE,
  SEEDED_POST_SLUG,
  SEEDED_PUBLISHED_PARTS,
  SEEDED_SECOND_POST_SLUG,
  SEEDED_SERIES_SLUG,
  SEEDED_SERIES_TITLE,
} from "./support/constants"

/**
 * Series: an ordered run of posts, and the navigation between them.
 *
 * The seeded series has three parts and only two of them are published. That is
 * the whole point of the fixture: almost every assertion here is really asking
 * whether the unpublished third part leaks into a count, a link or a list.
 */
test.describe("a series", () => {
  test.skip(
    !process.env.DATABASE_URL,
    "needs a seeded database - see npm run db:up / db:migrate / db:seed"
  )

  test("lists its published parts, in reading order", async ({ page }) => {
    await page.goto(`/blog/series/${SEEDED_SERIES_SLUG}`)

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(SEEDED_SERIES_TITLE)

    const parts = page.getByRole("listitem").getByRole("link")
    await expect(parts).toHaveCount(SEEDED_PUBLISHED_PARTS)

    // Ordered by the author's `seriesOrder`, not by publication date.
    await expect(parts.nth(0)).toHaveAttribute("href", `/blog/${SEEDED_POST_SLUG}`)
    await expect(parts.nth(1)).toHaveAttribute("href", `/blog/${SEEDED_SECOND_POST_SLUG}`)
  })

  test("leaves the unpublished part out entirely", async ({ page }) => {
    await page.goto(`/blog/series/${SEEDED_SERIES_SLUG}`)

    expect(await page.content()).not.toContain(SEEDED_DRAFT_SLUG)
    await expect(page.getByText(SEEDED_DRAFT_TITLE)).toHaveCount(0)
  })

  test("404s a series nobody has written", async ({ page }) => {
    const response = await page.goto("/blog/series/no-such-series")

    expect(response?.status()).toBe(404)
  })

  test("tells a reader where the article sits, counting only what they can open", async ({
    page,
  }) => {
    await page.goto(`/blog/${SEEDED_POST_SLUG}`)

    const nav = page.getByRole("navigation", { name: /series navigation/i })

    // "1 of 2", never "1 of 3" - a reader sent looking for a part that answers
    // 404 is worse than not knowing it exists.
    await expect(nav).toContainText(`Part 1 of ${SEEDED_PUBLISHED_PARTS}`)
    await expect(nav.getByRole("link", { name: SEEDED_SERIES_TITLE })).toHaveAttribute(
      "href",
      `/blog/series/${SEEDED_SERIES_SLUG}`
    )
  })

  test("links forward from the first part and back from the last", async ({ page }) => {
    await page.goto(`/blog/${SEEDED_POST_SLUG}`)

    const first = page.getByRole("navigation", { name: /series navigation/i })
    // Nothing before part one.
    await expect(first.locator('a[rel="prev"]')).toHaveCount(0)
    await expect(first.locator('a[rel="next"]')).toHaveAttribute(
      "href",
      `/blog/${SEEDED_SECOND_POST_SLUG}`
    )

    await page.goto(`/blog/${SEEDED_SECOND_POST_SLUG}`)

    const last = page.getByRole("navigation", { name: /series navigation/i })
    await expect(last).toContainText(`Part 2 of ${SEEDED_PUBLISHED_PARTS}`)
    await expect(last.locator('a[rel="prev"]')).toHaveAttribute("href", `/blog/${SEEDED_POST_SLUG}`)
    // The draft is next in the author's ordering, and must not be offered.
    await expect(last.locator('a[rel="next"]')).toHaveCount(0)
  })

  test("is in the sitemap, and is indexable", async ({ page, request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text()
    expect(sitemap).toContain(`/blog/series/${SEEDED_SERIES_SLUG}`)

    await page.goto(`/blog/series/${SEEDED_SERIES_SLUG}`)
    const robots = page.locator('meta[name="robots"]')

    // A series page collects articles under a heading nothing else provides, so
    // unlike search it is a real entry point.
    if ((await robots.count()) > 0) {
      await expect(robots).not.toHaveAttribute("content", /noindex/)
    }
  })

  test("reads without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    await page.goto(`/blog/${SEEDED_POST_SLUG}`)
    await expect(page.getByRole("navigation", { name: /series navigation/i })).toContainText(
      `Part 1 of ${SEEDED_PUBLISHED_PARTS}`
    )

    await context.close()
  })
})
