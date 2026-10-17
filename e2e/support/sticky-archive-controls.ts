import { expect, type Page } from "@playwright/test"

export async function expectStickyArchiveControls(page: Page) {
  const toolbar = page.locator("[data-sticky-toolbar]")
  await expect(toolbar.getByRole("searchbox")).toBeVisible()
  await expect(
    page.getByRole("navigation", { name: /^(Writing pages|Posts pagination)$/ })
  ).toBeAttached()
  await page.evaluate(() => window.scrollTo(0, 700))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300)
  const assertBelowHeader = async () => {
    await expect
      .poll(async () => {
        const header = await page.locator("header").first().boundingBox()
        const controls = await toolbar.boundingBox()
        return Math.abs(controls!.y - (header!.y + header!.height))
      })
      .toBeLessThanOrEqual(1)
    const header = page.locator("header").first()
    const surface = toolbar.locator("[data-sticky-toolbar-surface]")
    await expect
      .poll(async () => {
        const bounds = await surface.boundingBox()
        const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth)
        return Math.max(Math.abs(bounds!.x), Math.abs(bounds!.width - viewportWidth))
      })
      .toBeLessThanOrEqual(1)
    await expect(surface).toHaveCSS(
      "background-color",
      await header.evaluate((element) => getComputedStyle(element).backgroundColor)
    )
    await expect(surface).toHaveCSS(
      "backdrop-filter",
      await header.evaluate((element) => getComputedStyle(element).backdropFilter)
    )
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      )
    ).toBe(false)
    await expect(toolbar.getByRole("searchbox")).toBeVisible()
    await expect(toolbar.getByRole("button", { name: "Filters and sort" })).toBeVisible()
  }
  await assertBelowHeader()
  // Header wrapping can change without navigation, for example after rotating a phone.
  const viewport = page.viewportSize()!
  await page.setViewportSize({ ...viewport, width: viewport.width === 320 ? 1280 : 320 })
  await assertBelowHeader()
  await toolbar.getByRole("button", { name: "Filters and sort" }).click()
  await expect(page.getByRole("dialog", { name: "Filters and sort" })).toBeVisible()
}
