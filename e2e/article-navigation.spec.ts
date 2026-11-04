import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

const headings = [
  { id: "user-content-first", text: "First section", level: 2 },
  { id: "user-content-sub", text: "Nested section", level: 3 },
  { id: "user-content-detail", text: "Detailed section", level: 4 },
  { id: "user-content-last", text: "Last section", level: 2 },
]

async function preview(page: Page) {
  await page.route("**/api/writing/preview/toc-fixture?**", (route) =>
    route.fulfill({
      json: {
        post: {
          id: "toc-fixture",
          slug: "toc-fixture",
          title: "An article with nested sections",
          excerpt: "An isolated article-navigation browser fixture.",
          coverUrl: null,
          coverAlt: null,
          status: "draft",
          publishedAt: null,
          updatedAt: "2026-11-04T00:00:00Z",
          readingTime: 8,
          tags: [],
          seriesContext: null,
        },
        article: {
          headings,
          html: headings
            .map(
              ({ id, text, level }) =>
                `<h${level} id="${id}" tabindex="-1">${text}</h${level}>` +
                Array.from(
                  { length: 8 },
                  () => `<p>${"Readable article text. ".repeat(12)}</p>`
                ).join("")
            )
            .join(""),
        },
      },
    })
  )
  await page.goto("/writing/toc-fixture/preview?token=browser-fixture")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "An article with nested sections"
  )
}

for (const width of [390, 1024, 1440]) {
  test(`article contents are hierarchical and responsive at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await preview(page)
    const toc = page.locator("[data-article-toc]")
    const summary = toc.locator("summary")
    if (width < 1200) {
      await expect(summary).toBeVisible()
      await expect(toc.locator("details")).not.toHaveAttribute("open")
      await summary.focus()
      await page.keyboard.press("Enter")
      await expect(toc.locator("details")).toHaveAttribute("open", "")
    } else {
      await expect(summary).toBeHidden()
      const card = page.locator("article > div").last()
      const navigationBounds = (await toc.boundingBox())!
      expect(navigationBounds.x + navigationBounds.width).toBeLessThan(
        (await card.boundingBox())!.x
      )
    }
    const nav = page.getByRole("navigation", { name: "On this page", exact: true })
    await expect(nav).toHaveCount(1)
    await expect(nav.locator("ol > li > ol > li > ol > li > a")).toHaveText("Detailed section")
    await nav.getByRole("link", { name: "Detailed section", exact: true }).click()
    await expect(page).toHaveURL(/#user-content-detail$/)
    const target = page.locator("#user-content-detail")
    await expect(target).toBeFocused()
    if (width < 1200) await expect(toc.locator("details")).not.toHaveAttribute("open")
    await expect
      .poll(async () => {
        const header = (await page.locator("header").first().boundingBox())!
        const controls = (await toc.boundingBox())!
        const heading = (await target.boundingBox())!
        return (
          heading.y -
          Math.max(0, header.y + header.height, width < 1200 ? controls.y + controls.height : 0)
        )
      })
      .toBeGreaterThanOrEqual(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    )
  })
}

test("mobile contents stay below restored navigation and retain accessible disclosure controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await preview(page)
  const toc = page.locator("[data-article-toc]")
  await page.mouse.move(200, 500)
  await page.mouse.wheel(0, 700)
  await expect(page.locator("header").first()).toHaveAttribute("data-scroll-hidden", "true")
  await expect.poll(async () => (await toc.boundingBox())!.y).toBeLessThanOrEqual(1)
  await page.mouse.wheel(0, -100)
  await expect(page.locator("header").first()).toHaveAttribute("data-scroll-hidden", "false")
  await expect
    .poll(async () => {
      const header = (await page.locator("header").first().boundingBox())!
      return Math.abs((await toc.boundingBox())!.y - header.y - header.height)
    })
    .toBeLessThanOrEqual(1)
  await toc.locator("summary").click()
  const results = await new AxeBuilder({ page })
    .include("article")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze()
  expect(
    results.violations.filter(({ impact }) => impact === "serious" || impact === "critical")
  ).toEqual([])
  await page.emulateMedia({ media: "print" })
  await expect(toc).toBeHidden()
  await expect(page.locator("article")).toHaveCSS("display", "block")
})

for (const width of [390, 1440]) {
  test(`upward contents navigation clears the returning header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await preview(page)
    const header = page.locator("header").first()
    const toc = page.locator("[data-article-toc]")
    await page.evaluate(() => {
      const last = document.getElementById("user-content-last")!
      window.scrollTo({
        top: window.scrollY + last.getBoundingClientRect().top,
        behavior: "instant",
      })
    })
    await expect(header).toHaveAttribute("data-scroll-hidden", "true")
    if (width < 1200) await toc.locator("summary").click()
    await page
      .getByRole("navigation", { name: "On this page", exact: true })
      .getByRole("link", { name: "First section", exact: true })
      .click()
    await expect(page).toHaveURL(/#user-content-first$/)
    await expect(header).toHaveAttribute("data-scroll-hidden", "false")
    await expect.poll(async () => (await header.boundingBox())!.y).toBeGreaterThanOrEqual(0)
    const target = page.locator("#user-content-first")
    await expect(target).toBeFocused()
    await expect
      .poll(async () => {
        const navigation = (await header.boundingBox())!
        const contents = (await toc.boundingBox())!
        const heading = (await target.boundingBox())!
        return (
          heading.y -
          Math.max(
            navigation.y + navigation.height,
            width < 1200 ? contents.y + contents.height : 0
          )
        )
      })
      .toBeGreaterThanOrEqual(0)
  })
}
