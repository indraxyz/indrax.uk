import { execFileSync } from "node:child_process"
import { expect, test } from "@playwright/test"

const updatedAt =
  process.env.NEXT_PUBLIC_SITE_UPDATED_AT?.trim() ||
  execFileSync("git", ["log", "-1", "--format=%cs"], { encoding: "utf8" }).trim()

test("shares the built revision date across public footers, profile metadata and sitemap", async ({
  page,
  request,
}) => {
  const label = new Date(`${updatedAt}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
  await page.setViewportSize({ width: 320, height: 900 })
  for (const path of ["/", "/resume", "/tech-stack", "/writing"]) {
    await page.goto(path)
    const date = page.getByRole("contentinfo").locator("time")
    await expect(date).toHaveAttribute("datetime", updatedAt)
    await expect(date).toHaveText(label)
    const footer = page.getByRole("contentinfo")
    expect(await footer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true
    )
    if (path === "/") {
      const profile = JSON.parse(
        (await page.locator('script[type="application/ld+json"]').textContent())!
      )
      expect(profile.dateModified).toBe(updatedAt)
    }
  }
  const response = await request.get("/sitemap.xml")
  expect(response.ok()).toBe(true)
  const entries = (await response.text()).match(/<url>[\s\S]*?<\/url>/g)!
  // Home/resume/Stack are the first unconditional entries, before authored posts.
  for (const entry of entries.slice(0, 3))
    expect(entry).toContain(`<lastmod>${updatedAt}T00:00:00.000Z</lastmod>`)
})
