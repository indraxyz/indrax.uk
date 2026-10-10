import { expect, test } from "@playwright/test"

import { E2E_POSTHOG_HOST } from "./support/constants"

/**
 * The public writing surface, asserted without a database.
 *
 * Everything here holds whether or not `DATABASE_URL` is set: the routes exist,
 * the feed and the sitemap are well-formed, drafts and unknown slugs 404, and an
 * empty archive renders an empty state rather than a crash. Content-dependent
 * assertions live in `writing-content.spec.ts`, which needs a seeded database.
 */
test.describe("the writing public surface", () => {
  test("lists articles without crashing, empty or not", async ({ page }) => {
    const errors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text())
    })

    const response = await page.goto("/writing")

    expect(response?.status()).toBe(200)
    // The list page has no hero, so its section header is the page h1.
    await expect(page.getByRole("heading", { level: 1, name: "Writing" })).toBeVisible()
    await expect(page.getByRole("main")).toBeVisible()
    expect(errors).toEqual([])
  })

  test("loads cards from the API and retries only when the reader requests it", async ({
    page,
  }) => {
    let requests = 0
    await page.route("**/api/writing/posts*", async (route) => {
      requests += 1
      if (requests === 1)
        return route.fulfill({ status: 503, json: { message: "Temporarily unavailable" } })
      return route.fulfill({
        json: {
          posts: [
            {
              id: "client-post",
              slug: "client-card",
              title: "Client API card",
              excerpt: "Fetched in the browser",
              coverUrl: null,
              coverAlt: null,
              publishedAt: "2026-10-09T00:00:00Z",
              updatedAt: "2026-10-09T00:00:00Z",
              readingTime: 1,
              tags: [],
            },
          ],
          page: 1,
          pageCount: 1,
        },
      })
    })
    await page.goto("/writing")
    await expect(page.getByRole("alert")).toContainText("Unable to load writing")
    expect(requests).toBe(1)
    await page.getByRole("button", { name: "Try again" }).click()
    await expect(page.getByRole("link", { name: "Client API card" })).toBeVisible()
    expect(requests).toBe(2)
  })

  test("404s an unknown slug with the site's own not-found page", async ({ page }) => {
    const response = await page.goto("/writing/no-such-article-exists")

    expect(response?.status()).toBe(404)
    await expect(page.getByRole("heading", { level: 1, name: "Not found" })).toBeVisible()
  })

  test("redirects legacy tag pages into archive filters", async ({ page }) => {
    const response = await page.goto("/writing/tags/no-such-tag")

    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/writing\?tag=no-such-tag$/)
    await expect(page.getByRole("heading", { level: 1, name: "Writing" })).toBeVisible()
  })

  test("serves a valid RSS 2.0 feed", async ({ request }) => {
    const response = await request.get("/writing/rss.xml")

    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("application/rss+xml")

    const xml = await response.text()
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<rss version="2.0"')
    expect(xml).toContain("<channel>")
    expect(xml).toContain('rel="self"')

    // Every URL in a feed is read somewhere other than this origin, so a relative
    // one would point at whatever the reader happens to be.
    for (const [, href] of xml.matchAll(/<link>([^<]+)<\/link>/g)) {
      expect(href).toMatch(/^https?:\/\//)
    }
  })

  test("permanently redirects legacy writing and feed URLs", async ({ request }) => {
    const legacyPaths = [
      ["/writing/search?q=typescript&page=2", "/writing?q=typescript&page=2"],
      ["/writing/tags/typescript?page=2", "/writing?page=2&tag=typescript"],
      ["/blog", "/writing"],
      ["/blog?ref=legacy", "/writing?ref=legacy"],
      ["/blog/old-article?ref=legacy", "/writing/old-article?ref=legacy"],
      ["/blog/tag/typescript?page=2", "/writing/tags/typescript?page=2"],
      ["/blog/search?q=typescript", "/writing/search?q=typescript"],
      ["/blog/series/example?page=2", "/writing/series/example?page=2"],
      ["/blog/an-article/preview?token=example", "/writing/an-article/preview?token=example"],
      ["/rss.xml", "/writing/rss.xml"],
    ] as const

    for (const [source, destination] of legacyPaths) {
      const response = await request.get(source, { maxRedirects: 0 })
      const location = new URL(response.headers().location!, "http://localhost")

      expect(response.status(), source).toBe(308)
      expect(`${location.pathname}${location.search}`).toBe(destination)
    }
  })

  test("advertises the feed from every page", async ({ page }) => {
    for (const path of ["/", "/writing"]) {
      // Stepped, so a failure names the route that lost the link rather than just
      // the loop.
      await test.step(path, async () => {
        await page.goto(path)
        const feed = page.locator('head link[rel="alternate"][type="application/rss+xml"]')
        await expect(feed).toHaveCount(1)
        await expect(feed).toHaveAttribute("href", "/writing/rss.xml")
      })
    }
  })

  test("serves a well-formed sitemap and keeps the admin out of robots", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text()
    expect(robots).toContain("Disallow: /admin")
    expect(robots).toContain("Sitemap:")

    const sitemap = await request.get("/sitemap.xml")
    expect(sitemap.status()).toBe(200)

    const xml = await sitemap.text()
    expect(xml).toContain("<urlset")
    // The root entry is unconditional, so it can be asserted with no database.
    // The /writing entry depends on something being published and is covered in
    // writing-content.spec.ts instead.
    expect(xml).toMatch(/<loc>https?:\/\/[^<]+<\/loc>/)
  })

  test("sets the baseline security headers", async ({ request }) => {
    const headers = (await request.get("/writing")).headers()

    expect(headers["x-content-type-options"]).toBe("nosniff")
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin")
    expect(headers["x-frame-options"]).toBe("DENY")
    expect(headers["strict-transport-security"]).toContain("max-age=")

    const csp = headers["content-security-policy"] ?? ""
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("base-uri 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("frame-src 'none'")
    expect(csp).toContain("style-src 'self' 'unsafe-inline'")

    // With no `script-src` this is what bounds an injected script: it may still
    // run, but only this origin and the analytics endpoint will accept what it
    // tries to send.
    expect(csp).toContain("connect-src 'self' ")
    // Derived from the same constant the tracker uses. A policy naming a
    // different host blocks every event, which looks like an outage rather than
    // a typo - so the two are asserted to agree.
    expect(csp).toContain(E2E_POSTHOG_HOST)

    // `default-src` is the fallback for `script-src`, so setting it would block
    // React Router's inline bootstrap and the theme script - the page would render
    // unstyled and unthemed. Asserted so nobody adds it without meaning to.
    expect(csp).not.toContain("default-src")
  })
})
