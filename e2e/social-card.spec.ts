import { expect, test } from "@playwright/test"

async function metaContent(page: import("@playwright/test").Page, selector: string) {
  return page.locator(selector).first().getAttribute("content")
}

test.describe("the social card", () => {
  test("is served as a 1200x630 PNG", async ({ request }) => {
    const response = await request.get("/opengraph-image")

    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("image/png")

    const body = await response.body()
    // PNG magic bytes, then the IHDR width/height as big-endian uint32s.
    expect(body.subarray(1, 4).toString("ascii")).toBe("PNG")
    expect(body.readUInt32BE(16)).toBe(1200)
    expect(body.readUInt32BE(20)).toBe(630)
  })

  test("is reused for the Twitter/X card rather than built twice", async ({ page }) => {
    await page.goto("/")

    // Next derives `twitter:image` from the Open Graph route, so there is no second
    // card to keep in step - and no `twitter-image` file in a codebase that has
    // nothing else to do with Twitter.
    const twitterImage = await page
      .locator('meta[name="twitter:image"]')
      .first()
      .getAttribute("content")

    expect(twitterImage).toContain("/opengraph-image")
  })

  test("is advertised as an absolute URL on a large card", async ({ page }) => {
    await page.goto("/")

    const ogImage = await metaContent(page, 'meta[property="og:image"]')
    const twitterImage = await metaContent(page, 'meta[name="twitter:image"]')

    expect(ogImage).toMatch(/^https?:\/\//)
    expect(twitterImage).toMatch(/^https?:\/\//)
    expect(await metaContent(page, 'meta[name="twitter:card"]')).toBe("summary_large_image")
    expect(await metaContent(page, 'meta[property="og:image:width"]')).toBe("1200")
    expect(await metaContent(page, 'meta[property="og:image:height"]')).toBe("630")
  })

  test("no longer advertises the bare profile photo as the card", async ({ page }) => {
    await page.goto("/")

    // The designed banner replaced it; listing both would let a platform pick the
    // small square instead.
    const images = await page.locator('meta[property="og:image"]').all()
    for (const image of images) {
      expect(await image.getAttribute("content")).not.toContain("foto-profile.jpg")
    }
  })
})
