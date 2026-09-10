import { expect, test } from "@playwright/test"

/**
 * The blog's public surface, asserted without a database.
 *
 * Everything here holds whether or not `DATABASE_URL` is set: the routes exist,
 * the feed and the sitemap are well-formed, drafts and unknown slugs 404, and an
 * empty archive renders an empty state rather than a crash. Content-dependent
 * assertions live in `blog-content.spec.ts`, which needs a seeded database.
 */
test.describe("the blog's public surface", () => {
  test("lists articles without crashing, empty or not", async ({ page }) => {
    const errors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text())
    })

    const response = await page.goto("/blog")

    expect(response?.status()).toBe(200)
    // The list page has no hero, so its section header is the page h1.
    await expect(page.getByRole("heading", { level: 1, name: "Writing" })).toBeVisible()
    await expect(page.getByRole("main")).toBeVisible()
    expect(errors).toEqual([])
  })

  test("404s an unknown slug with the site's own not-found page", async ({ page }) => {
    const response = await page.goto("/blog/no-such-article-exists")

    expect(response?.status()).toBe(404)
    await expect(page.getByRole("heading", { level: 1, name: "Not found" })).toBeVisible()
  })

  test("404s an unknown tag", async ({ page }) => {
    const response = await page.goto("/blog/tag/no-such-tag")

    expect(response?.status()).toBe(404)
  })

  test("serves a valid RSS 2.0 feed", async ({ request }) => {
    const response = await request.get("/rss.xml")

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

  test("advertises the feed from every page", async ({ page }) => {
    for (const path of ["/", "/blog"]) {
      // Stepped, so a failure names the route that lost the link rather than just
      // the loop.
      await test.step(path, async () => {
        await page.goto(path)
        await expect(
          page.locator('head link[rel="alternate"][type="application/rss+xml"]')
        ).toHaveCount(1)
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
    // The /blog entry depends on something being published and is covered in
    // blog-content.spec.ts instead.
    expect(xml).toMatch(/<loc>https?:\/\/[^<]+<\/loc>/)
  })

  test("sets the baseline security headers", async ({ request }) => {
    const headers = (await request.get("/blog")).headers()

    expect(headers["x-content-type-options"]).toBe("nosniff")
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin")
    expect(headers["x-frame-options"]).toBe("DENY")
    expect(headers["strict-transport-security"]).toContain("max-age=")

    const csp = headers["content-security-policy"] ?? ""
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("base-uri 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("form-action 'self'")

    // `default-src` is the fallback for `script-src`, so setting it would block
    // Next's own inline bootstrap and the theme script - the page would render
    // unstyled and unthemed. Asserted so nobody adds it without meaning to.
    expect(csp).not.toContain("default-src")
  })
})
