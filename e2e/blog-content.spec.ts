import { expect, test } from "@playwright/test"

import { SEEDED_DRAFT_SLUG, SEEDED_POST_SLUG, SEEDED_TAG_SLUG } from "./support/constants"

/**
 * The parts of the blog that need content to mean anything.
 *
 * Skipped unless a database is configured, so a clone with no Postgres still
 * runs a green suite. To run it:
 *
 *   npm run db:up && npm run db:migrate && npm run db:seed
 *   DATABASE_URL=... npm run test:e2e
 *
 * The assertions are written against the seeded set in `lib/db/seed.ts`, which
 * exists to exercise the read path rather than to read well.
 */
test.describe("a seeded blog", () => {
  test.skip(
    !process.env.DATABASE_URL,
    "needs a seeded database - see npm run db:up / db:migrate / db:seed"
  )

  test("renders an article, its dates and its reading time", async ({ page }) => {
    await page.goto(`/blog/${SEEDED_POST_SLUG}`)

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    // Exactly one h1: the title. The markdown pipeline shifts body headings so an
    // author writing `#` cannot produce a second one.
    await expect(page.locator("h1")).toHaveCount(1)

    // Scoped to the article itself: the related-posts strip is a sibling of
    // `<article>` and carries its own dates and reading times, so an unscoped
    // match finds several.
    const article = page.locator("article")
    await expect(article.locator("time").first()).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/)
    await expect(article.getByText(/\d+ min read/i)).toBeVisible()
  })

  test("does not skip a heading level in the body", async ({ page }) => {
    await page.goto(`/blog/${SEEDED_POST_SLUG}`)

    const levels = await page
      .locator(".prose :is(h2, h3, h4, h5, h6)")
      .evaluateAll((nodes) => nodes.map((node) => Number(node.tagName.slice(1))))

    expect(levels.length).toBeGreaterThan(0)
    // The first body heading sits directly under the title's h1.
    expect(levels[0]).toBe(2)
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1)
    }
  })

  test("highlights code on the server and names the block", async ({ page }) => {
    await page.goto(`/blog/${SEEDED_POST_SLUG}`)

    const block = page.locator(".prose pre").first()
    await expect(block).toBeVisible()
    await expect(block).toHaveAttribute("tabindex", "0")
    await expect(block).toHaveAttribute("aria-label", /Code sample/)

    // Both palettes are emitted in one server-side pass, which is what lets the
    // theme change without a highlighter in the browser.
    const style = await block.locator("span[style]").first().getAttribute("style")
    expect(style).toContain("--shiki-light")
    expect(style).toContain("--shiki-dark")
  })

  test("ships neither the editor nor the highlighter to the browser", async ({ page }) => {
    const scripts: string[] = []
    page.on("response", (response) => {
      if (response.url().endsWith(".js")) scripts.push(response.url())
    })

    await page.goto(`/blog/${SEEDED_POST_SLUG}`, { waitUntil: "networkidle" })
    expect(scripts.length).toBeGreaterThan(0)

    for (const url of scripts) {
      const body = await (await page.request.get(url)).text()
      // The article body is rendered on the server, so none of what renders it has
      // any business in the browser. Matched on identifiers rather than bare words
      // - "Tiptap" and "Drizzle" both appear in the resume's own tech-stack copy.
      for (const forbidden of [
        "createHighlighter",
        "rehype-pretty-code",
        "prosemirror",
        "@tiptap/core",
        "drizzle-orm",
        "@neondatabase",
      ]) {
        expect(body, `${forbidden} reached the client in ${url}`).not.toContain(forbidden)
      }
    }
  })

  test("renders the body with JavaScript disabled", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    await page.goto(`/blog/${SEEDED_POST_SLUG}`)
    await expect(page.locator(".prose p").first()).not.toBeEmpty()
    await expect(page.locator(".prose pre").first()).toBeVisible()

    await context.close()
  })

  test("keeps drafts unreachable, unlisted and unfed", async ({ page, request }) => {
    // 404, not 403: confirming the row exists is itself the leak.
    const response = await page.goto(`/blog/${SEEDED_DRAFT_SLUG}`)
    expect(response?.status()).toBe(404)

    const feed = await (await request.get("/rss.xml")).text()
    expect(feed).not.toContain(SEEDED_DRAFT_SLUG)

    const sitemap = await (await request.get("/sitemap.xml")).text()
    expect(sitemap).not.toContain(SEEDED_DRAFT_SLUG)
    // The published half of the same assertion: the archive is listed once there
    // is something in it.
    expect(sitemap).toContain("/blog<")

    const list = await page.goto("/blog")
    expect(list?.status()).toBe(200)
    expect(await page.content()).not.toContain(SEEDED_DRAFT_SLUG)
  })

  test("filters by tag and stays indexable", async ({ page }) => {
    await page.goto(`/blog/tag/${SEEDED_TAG_SLUG}`)

    // Named, or this asserts nothing - every page on the site has a heading.
    await expect(page.getByRole("heading", { level: 1, name: /typescript/i })).toBeVisible()
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`/blog/tag/${SEEDED_TAG_SLUG}$`)
    )
    await expect(page.locator('head meta[name="robots"][content*="noindex"]')).toHaveCount(0)
  })

  test("emits Article and BreadcrumbList structured data", async ({ page }) => {
    await page.goto(`/blog/${SEEDED_POST_SLUG}`)

    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    const parsed = blocks.map((block) => JSON.parse(block))

    const article = parsed.find((entry) => entry["@type"] === "Article")
    expect(article).toBeTruthy()
    for (const key of ["headline", "datePublished", "dateModified", "author", "image"]) {
      expect(article[key], `Article.${key}`).toBeTruthy()
    }

    const breadcrumbs = parsed.find((entry) => entry["@type"] === "BreadcrumbList")
    expect(breadcrumbs.itemListElement).toHaveLength(3)
    expect(breadcrumbs.itemListElement[0].position).toBe(1)
  })

  test("serves a 1200x630 card for the article", async ({ request }) => {
    const response = await request.get(`/blog/${SEEDED_POST_SLUG}/opengraph-image`)

    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toBe("image/png")

    const body = await response.body()
    // PNG signature, then the IHDR width and height as big-endian uint32s.
    expect(body.subarray(1, 4).toString()).toBe("PNG")
    expect(body.readUInt32BE(16)).toBe(1200)
    expect(body.readUInt32BE(20)).toBe(630)
  })

  test("reads without a horizontal scrollbar on a phone", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const page = await context.newPage()
    await page.goto(`/blog/${SEEDED_POST_SLUG}`)

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    )
    expect(overflows).toBe(false)

    const fontSize = await page
      .locator(".prose p")
      .first()
      .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize))
    expect(fontSize).toBeGreaterThanOrEqual(16)

    await context.close()
  })

  test("canonicalises each archive page to itself, not to page one", async ({ page }) => {
    await page.goto("/blog?page=2")

    // Pointing page two at page one tells a crawler it is a duplicate, which would
    // undo the reason the pagination is built from real links.
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/blog\?page=2$/
    )
  })

  test("builds a contents list from the article's own headings", async ({ page }) => {
    await page.goto(`/blog/${SEEDED_POST_SLUG}`)

    const toc = page.getByRole("navigation", { name: /on this page/i })
    await expect(toc).toBeVisible()

    // Every entry must point at a heading that exists, or the list is decoration
    // that lies.
    const targets = await toc
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).getAttribute("href")))
    expect(targets.length).toBeGreaterThan(0)

    for (const target of targets) {
      await expect(page.locator(target!)).toHaveCount(1)
    }
  })

  test("offers other articles sharing a tag, and never itself", async ({ page }) => {
    await page.goto(`/blog/${SEEDED_POST_SLUG}`)

    const related = page.getByRole("heading", { level: 2, name: "Related" })
    await expect(related).toBeVisible()

    const links = page.locator("a[href^='/blog/']", { hasNotText: "" })
    const hrefs = await page
      .locator("main a[href^='/blog/']")
      .evaluateAll((nodes) => nodes.map((node) => (node as HTMLAnchorElement).getAttribute("href")))

    expect(links).toBeTruthy()
    // Recommending the article you are already reading is the classic bug here.
    expect(hrefs.filter((href) => href === `/blog/${SEEDED_POST_SLUG}`)).toHaveLength(0)
  })

  test("renders task lists as one item each, not two", async ({ page }) => {
    await page.goto(`/blog/${SEEDED_POST_SLUG}`)

    const item = page.locator('.prose ul[data-type="taskList"] > li').first()
    await expect(item).toBeVisible()

    // The checkbox sits beside its text rather than above it. Without the flex
    // layout Typography draws a bullet too and wraps the text underneath, so each
    // item reads as two - which is how it first shipped.
    await expect(item).toHaveCSS("display", "flex")
    await expect(item.locator("input[type=checkbox]")).toHaveAttribute("aria-label", /.+/)
  })

  test("counts a read without shipping a script to do it", async ({ page }) => {
    const pixels: string[] = []
    page.on("request", (request) => {
      if (request.url().includes("/api/views/")) pixels.push(request.url())
    })

    await page.goto(`/blog/${SEEDED_POST_SLUG}`, { waitUntil: "networkidle" })

    expect(pixels.length).toBeGreaterThan(0)
    // An image, so it fires on a cached page and for a reader with JavaScript off.
    const beacon = page.locator(`img[src*="/api/views/"]`)
    await expect(beacon).toHaveCount(1)
    await expect(beacon).toHaveAttribute("aria-hidden", "true")
  })

  test("adds copy buttons to code blocks only after the page has rendered", async ({
    browser,
    page,
  }) => {
    // With scripting off there must be no dead controls - the enhancement is
    // additive, and the article is complete without it.
    const noScript = await browser.newContext({ javaScriptEnabled: false })
    const plain = await noScript.newPage()
    await plain.goto(`/blog/${SEEDED_POST_SLUG}`)
    await expect(plain.locator(".prose pre")).not.toHaveCount(0)
    await expect(plain.locator(".prose figure button")).toHaveCount(0)
    await noScript.close()

    await page.goto(`/blog/${SEEDED_POST_SLUG}`, { waitUntil: "networkidle" })
    const buttons = page.locator(".prose figure button")
    await expect(buttons.first()).toHaveText(/copy/i)
    expect(await buttons.count()).toBe(await page.locator(".prose pre").count())
  })

  test("surfaces the blog from the resume page", async ({ page }) => {
    await page.goto("/")

    const link = page.getByRole("link", { name: /all articles/i })
    await expect(link).toBeVisible()
    // Same-site, so it must not steal the tab.
    await expect(link).not.toHaveAttribute("target", "_blank")
  })
})
