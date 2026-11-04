import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

const headings = [
  { id: "user-content-first", text: "First section", level: 2 },
  { id: "user-content-sub", text: "Nested section", level: 3 },
  { id: "user-content-detail", text: "Detailed section", level: 4 },
  { id: "user-content-last", text: "Last section", level: 2 },
  { id: "user-content-last-sub", text: "Last subsection", level: 3 },
]

async function preview(page: Page, paragraphs = 8) {
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
                  { length: paragraphs },
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
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await preview(page)
    await expect(page.locator("html")).toHaveCSS("scroll-behavior", "smooth")
    const toc = page.locator("[data-article-toc]")
    const summary = toc.locator("[data-toc-mobile] > summary")
    if (width < 1200) {
      await expect(summary).toBeVisible()
      await expect(toc.locator("[data-toc-mobile]")).not.toHaveAttribute("open")
      await summary.focus()
      await page.keyboard.press("Enter")
      await expect(toc.locator("[data-toc-mobile]")).toHaveAttribute("open", "")
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
    await nav.getByLabel("Child sections for First section", { exact: true }).click()
    await nav.getByLabel("Child sections for Nested section", { exact: true }).click()
    await expect(nav.locator("ol ol ol a")).toHaveText("Detailed section")
    await nav.getByRole("link", { name: "Detailed section", exact: true }).click()
    await expect(page).toHaveURL(/#user-content-detail$/)
    const target = page.locator("#user-content-detail")
    await expect(target).toBeFocused()
    await expect.poll(async () => (await target.boundingBox())!.y).toBeLessThan(300)
    if (width < 1200) await expect(toc.locator("[data-toc-mobile]")).not.toHaveAttribute("open")
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
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto")
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
  await toc.locator("[data-toc-mobile] > summary").click()
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
    if (width < 1200) await toc.locator("[data-toc-mobile] > summary").click()
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

for (const width of [390, 1440]) {
  test(`contents branches start closed and expand independently with keyboard at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await preview(page)
    const toc = page.locator("[data-article-toc]")
    if (width < 1200) await toc.locator("[data-toc-mobile] > summary").click()
    const nav = page.getByRole("navigation", { name: "On this page", exact: true })
    const first = nav.getByLabel("Child sections for First section", { exact: true })
    const last = nav.getByLabel("Child sections for Last section", { exact: true })
    await expect(first.locator("..")).not.toHaveAttribute("open")
    await expect(last.locator("..")).not.toHaveAttribute("open")
    await expect(nav.getByRole("link", { name: "Nested section", exact: true })).toBeHidden()
    await first.focus()
    await page.keyboard.press("Enter")
    await expect(first.locator("..")).toHaveAttribute("open", "")
    const nested = nav.getByLabel("Child sections for Nested section", { exact: true })
    await expect(nested.locator("..")).not.toHaveAttribute("open")
    const expectContinuousGuide = async () => {
      await expect
        .poll(() =>
          nav.locator("[data-toc-guide] path:not([data-toc-active-guide])").evaluate((element) => {
            const path = element as SVGPathElement
            const length = path.getTotalLength()
            if (!length) return false
            let previousY = -Infinity
            for (let distance = 0; distance <= length; distance += 0.5) {
              const { y } = path.getPointAtLength(distance)
              if (y < previousY - 0.01) return false
              previousY = y
            }
            return true
          })
        )
        .toBe(true)
    }
    // A collapsed grandchild must not pull the return line through the next title.
    await expectContinuousGuide()
    await toc.screenshot({ path: test.info().outputPath("contents-collapsed-child.png") })
    await nested.focus()
    await page.keyboard.press("Space")
    await expect(nav.getByRole("link", { name: "Detailed section", exact: true })).toBeVisible()
    await expectContinuousGuide()
    await toc.screenshot({ path: test.info().outputPath("contents-expanded-child.png") })
    await last.click()
    await expect(last.locator("..")).toHaveAttribute("open", "")
    await expect(first.locator("..")).toHaveAttribute("open", "")
    await expect(nav.getByRole("link", { name: "Last subsection", exact: true })).toBeVisible()
    await expectContinuousGuide()
    await first.click()
    await expect(first.locator("..")).not.toHaveAttribute("open")
    await expect(nav.getByRole("link", { name: "Detailed section", exact: true })).toBeHidden()
    await expect(last.locator("..")).toHaveAttribute("open", "")
    await expect(nav.getByRole("link", { name: "Last subsection", exact: true })).toBeVisible()
    const result = await new AxeBuilder({ page }).include("[data-article-toc]").analyze()
    expect(
      result.violations.filter(({ impact }) => impact === "serious" || impact === "critical")
    ).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    )
  })
}

for (const width of [390, 1440]) {
  test(`contents follow the reading position without opening collapsed branches at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: "no-preference" })
    await preview(page)
    const toc = page.locator("[data-article-toc]")
    if (width < 1200) await toc.locator("[data-toc-mobile] > summary").click()
    const nav = width < 1200 ? toc.locator("[data-toc-mobile] > nav") : toc.locator(":scope > nav")
    const first = nav.getByRole("link", { name: "First section", exact: true })
    await expect(first).toHaveAttribute("aria-current", "location")
    const guide = nav.locator("[data-toc-active-guide]")
    const expectMatchingGuide = async (link: typeof first) => {
      await expect
        .poll(async () => {
          const guideColor = await guide.evaluate((node) => getComputedStyle(node).color)
          return guideColor === (await link.evaluate((node) => getComputedStyle(node).color))
        })
        .toBe(true)
      await expect.poll(() => guide.getAttribute("d")).toMatch(/^M[\d.]+,[\d.]+ V[\d.]+$/)
      await expect
        .poll(async () => {
          // A vertical SVG path has zero width, so Playwright's boundingBox
          // deliberately treats it as an empty box. Its DOM bounds retain y/height.
          const line = await guide.evaluate((node) => {
            const { y, height } = node.getBoundingClientRect()
            return { y, height }
          })
          const title = await link.boundingBox()
          return (
            !!title && Math.abs(line.y - title.y) < 1 && Math.abs(line.height - title.height) < 1
          )
        })
        .toBe(true)
    }
    await expectMatchingGuide(first)
    const firstBranch = nav
      .getByLabel("Child sections for First section", { exact: true })
      .locator("..")
    await expect(firstBranch).not.toHaveAttribute("open")
    await page
      .locator("#user-content-detail")
      .evaluate((node) => node.scrollIntoView({ behavior: "instant", block: "start" }))
    const detail = nav.locator('a[href="#user-content-detail"]')
    await expect(detail).toHaveAttribute("aria-current", "location")
    await expect(first).not.toHaveAttribute("aria-current")
    await expect(first).toHaveAttribute("data-toc-ancestor", "true")
    await expect(firstBranch).not.toHaveAttribute("open")
    await expectMatchingGuide(first)
    await page
      .locator("#user-content-last")
      .evaluate((node) => node.scrollIntoView({ behavior: "instant", block: "start" }))
    const last = nav.locator('a[href="#user-content-last"]')
    await expect(last).toHaveAttribute("aria-current", "location")
    await expect(first).not.toHaveAttribute("data-toc-ancestor")
    await expect(nav.locator('[aria-current="location"]')).toHaveCount(1)
    await expectMatchingGuide(last)
    const transition = await last.evaluate((node) => getComputedStyle(node).transitionProperty)
    expect(transition).toContain("color")
    await page.emulateMedia({ reducedMotion: "reduce" })
    await expect(last).toHaveCSS("transition-property", "none")
    await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto")
    await toc.screenshot({ path: test.info().outputPath(`contents-reading-state-${width}.png`) })
  })
}

test("short article contents begin with the first heading before the reader scrolls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1800 })
  await preview(page, 0)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  const nav = page.locator("[data-article-toc] > nav")
  await expect(nav.locator('[aria-current="location"]')).toHaveAttribute(
    "href",
    "#user-content-first"
  )
})
