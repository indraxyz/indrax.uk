import { execFileSync } from "node:child_process"
import { expect, test } from "@playwright/test"

const updatedAt =
  process.env.SITE_UPDATED_AT?.trim() ||
  execFileSync("git", ["log", "-1", "--format=%cs"], { encoding: "utf8" }).trim()

test("keeps revision dates in profile metadata and sitemap", async ({ page, request }) => {
  await page.goto("/")
  const profile = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent())!
  )
  expect(profile.dateModified).toBe(updatedAt)
  const response = await request.get("/sitemap.xml")
  expect(response.ok()).toBe(true)
  const entries = (await response.text()).match(/<url>[\s\S]*?<\/url>/g)!
  for (const entry of entries.slice(0, 3))
    expect(entry).toContain(`<lastmod>${updatedAt}T00:00:00.000Z</lastmod>`)
})

for (const theme of ["light", "dark"]) {
  for (const width of [320, 1232]) {
    test(`public footer controls and alignment in ${theme} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.addInitScript((preference) => {
        localStorage.setItem("indrax-analytics-consent", "denied")
        localStorage.setItem("indrax-theme", preference)
      }, theme)
      await page.route("**/api/writing/tags", (route) => route.fulfill({ json: [] }))
      await page.route("**/api/writing/posts*", (route) =>
        route.fulfill({
          json: { posts: [], total: 0, page: 1, pageCount: 0 },
        })
      )
      for (const path of ["/", "/resume", "/tech-stack", "/writing"]) {
        await page.goto(path)
        if (path === "/writing") {
          await expect(page.getByRole("status").filter({ hasText: /^0 articles$/ })).toBeVisible()
        }
        await expect(page.getByRole("status", { name: "Loading page", exact: true })).toBeHidden()
        const footer = page.getByRole("contentinfo")
        const year = await page.evaluate(() => new Date().getFullYear())
        await expect(footer.locator("p")).toHaveText(`© ${year} by Indra`)
        await expect(footer.locator("p")).toHaveCSS(
          "color",
          theme === "light" ? "rgb(57, 70, 53)" : "rgb(197, 215, 184)"
        )
        await expect(footer.locator("strong")).toHaveText("Indra")
        await expect(footer.locator("strong")).toHaveCSS("font-weight", "700")
        await page.evaluate(() => document.fonts.load('700 14px "JetBrains Mono"'))
        expect(
          await page.evaluate(() =>
            Array.from(document.fonts).some(
              (face) =>
                face.family === "JetBrains Mono" &&
                face.weight === "700" &&
                face.status === "loaded"
            )
          )
        ).toBe(true)

        const cookies = footer.getByRole("button", { name: "Cookie preferences" })
        const toggle = footer.getByRole("button", { name: /Switch theme/ })
        await expect(cookies).toBeVisible()
        await expect(toggle).toBeVisible()
        await expect(cookies).toHaveCSS("cursor", "pointer")
        await expect(toggle).toHaveCSS("cursor", "pointer")
        const copyright = footer.locator("p svg")
        await expect(copyright).toHaveClass(/lucide-copyright/)
        await expect(copyright).toHaveAttribute("aria-hidden", "true")
        for (const dimension of ["width", "height"]) {
          await expect(copyright).toHaveCSS(dimension, "14px")
          await expect(cookies.locator("svg")).toHaveCSS(dimension, "20px")
          await expect(toggle.locator("svg")).toHaveCSS(dimension, "20px")
          await expect(cookies).toHaveCSS(dimension, "44px")
          await expect(toggle).toHaveCSS(dimension, "44px")
        }
        await expect(footer.locator("p")).toHaveCSS("font-size", "14px")
        const copyrightBox = (await copyright.boundingBox())!
        const creditBox = (await footer.locator("p > span").boundingBox())!
        expect(
          Math.abs(copyrightBox.y + copyrightBox.height / 2 - creditBox.y - creditBox.height / 2)
        ).toBeLessThan(1)
        await expect(
          page.getByRole("banner").getByRole("button", { name: /Switch theme/ })
        ).toHaveCount(0)
        const textBox = (await footer.locator("p").boundingBox())!
        const cookieBox = (await cookies.boundingBox())!
        const themeBox = (await toggle.boundingBox())!
        expect(textBox.x + textBox.width).toBeLessThanOrEqual(cookieBox.x)
        expect(cookieBox.x + cookieBox.width).toBeLessThanOrEqual(themeBox.x)
        expect(
          Math.abs(textBox.y + textBox.height / 2 - themeBox.y - themeBox.height / 2)
        ).toBeLessThan(1)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true
        )
      }
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await page.screenshot({
        path: test.info().outputPath("public-footer.png"),
      })
      await page
        .getByRole("contentinfo")
        .getByRole("button", { name: /Switch theme/ })
        .click()
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        theme === "light" ? "dark" : "system"
      )
      await page
        .getByRole("contentinfo")
        .getByRole("button", { name: "Cookie preferences" })
        .click()
      await expect(page.getByRole("region", { name: "Analytics consent" })).toBeVisible()
    })
  }
}
