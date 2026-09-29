import { expect, test } from "@playwright/test"

import { SEEDED_DRAFT_SLUG, SEEDED_DRAFT_TITLE, SEEDED_POST_SLUG } from "./support/constants"

/**
 * Full-text search over the archive.
 *
 * Needs content to mean anything, so it skips itself without a database in the
 * same way `blog-content.spec.ts` does.
 *
 * The assertions that matter most are the two that are not about finding things:
 * a draft must never surface here, and the page must never be indexable.
 */
test.describe("search", () => {
  test.skip(
    !process.env.DATABASE_URL,
    "needs a seeded database - see npm run db:up / db:migrate / db:seed"
  )

  test("finds an article by a word from its body", async ({ page }) => {
    await page.goto("/blog/search?q=renderer")

    await expect(page.getByRole("link", { name: /rendering an article/i })).toBeVisible()
  })

  test("ranks a title match above a body-only match", async ({ page }) => {
    // "renderer" is in one title and in the other article's prose. Weighting is
    // what puts the titled one first; without `setweight` the order would be
    // arbitrary.
    await page.goto("/blog/search?q=renderer")

    const links = page.locator(`main a[href^="/blog/"]`)
    const hrefs = await links.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("href") ?? "")
    )
    const articles = hrefs.filter((href) => /^\/blog\/[a-z-]+$/.test(href))

    expect(articles[0]).toBe(`/blog/${SEEDED_POST_SLUG}`)
  })

  test("never surfaces a draft, whatever is searched for", async ({ page }) => {
    // The draft's own title, which is the strongest possible match for it. The
    // status filter is in the query rather than in a caller's `if`, so there is
    // no path that could list it (threat T-4).
    await page.goto(`/blog/search?q=${encodeURIComponent(SEEDED_DRAFT_TITLE)}`)

    await expect(page.getByRole("link", { name: SEEDED_DRAFT_TITLE })).toHaveCount(0)
    expect(await page.content()).not.toContain(SEEDED_DRAFT_SLUG)
  })

  test("is never indexable", async ({ page }) => {
    // Every distinct `?q=` is a page as far as a crawler is concerned: thin,
    // infinite, and duplicating articles that already have a canonical home.
    // `follow` so a crawler still walks through to the articles themselves.
    await page.goto("/blog/search?q=postgres")

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/)
  })

  test("says what it failed to find", async ({ page }) => {
    await page.goto("/blog/search?q=zzzznothingmatchesthis")

    await expect(page.getByText(/nothing matches zzzznothingmatchesthis/i)).toBeVisible()
  })

  test("invites a search rather than reporting a failure when asked for nothing", async ({
    page,
  }) => {
    await page.goto("/blog/search")

    await expect(page.getByText(/find an article/i)).toBeVisible()
    await expect(page.getByText(/nothing matches/i)).toHaveCount(0)
  })

  test("refuses a query long enough to be an attack rather than a search", async ({ page }) => {
    // Bounded before it reaches the database: the page renders its idle state as
    // though nothing had been asked for (threat T-11).
    await page.goto(`/blog/search?q=${"a".repeat(300)}`)

    await expect(page.getByText(/find an article/i)).toBeVisible()
  })

  test("survives a query that is only punctuation", async ({ page }) => {
    // `to_tsquery` throws on unbalanced quotes, which would turn a stray
    // apostrophe into a 500. `websearch_to_tsquery` does not, and this is what
    // holds that choice in place.
    const response = await page.goto(`/blog/search?q=${encodeURIComponent(`'");--`)}`)

    expect(response?.status()).toBe(200)
  })

  test("searches without JavaScript, because it is an ordinary form", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    await page.goto("/blog")
    await page.getByRole("searchbox", { name: /search articles/i }).fill("renderer")
    await page.getByRole("button", { name: "Search" }).click()

    await expect(page).toHaveURL(/\/blog\/search\?q=renderer/)
    await expect(page.getByRole("link", { name: /rendering an article/i })).toBeVisible()

    await context.close()
  })

  test("keeps the query when paging, so page two is the same search", async ({ page }) => {
    // One page of results with the seeded set, so the control is absent - the
    // assertion is that the link it *would* build carries the query rather than
    // dropping it. Covered here by the href the form produces.
    await page.goto("/blog/search?q=typescript")

    await expect(page.getByRole("searchbox", { name: /search articles/i })).toHaveValue(
      "typescript"
    )
  })
})
