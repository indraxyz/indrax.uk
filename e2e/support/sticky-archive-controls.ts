import { expect, type Locator, type Page } from "@playwright/test"

/** Match the header's visible edge, including its translated-away state. */
export async function expectBelowVisibleHeader(page: Page, toolbar: Locator) {
  await expect
    .poll(async () => {
      const header = (await page.locator("header").first().boundingBox())!
      const controls = (await toolbar.boundingBox())!
      return Math.abs(controls.y - Math.max(0, header.y + header.height))
    })
    .toBeLessThanOrEqual(1)
}

export async function expectStickyArchiveControls(page: Page) {
  const header = page.locator("header").first()
  const toolbar = page.locator("[data-sticky-toolbar]")
  await expect(toolbar.getByRole("searchbox")).toBeVisible()
  await expect(
    page.getByRole("navigation", { name: /^(Writing pages|Posts pagination)$/ })
  ).toBeAttached()
  await expect(header).toHaveAttribute("data-scroll-hidden", "false")
  expect((await toolbar.boundingBox())!.y).toBeGreaterThanOrEqual(
    (await header.boundingBox())!.height
  )
  await page.evaluate(() => window.scrollTo({ top: 700, behavior: "instant" }))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300)
  const assertBelowHeader = async () => {
    await expectBelowVisibleHeader(page, toolbar)
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
  await expect(header).toHaveAttribute("data-scroll-hidden", "true")
  await assertBelowHeader()
  await page.evaluate(() => window.scrollBy({ top: -100, behavior: "instant" }))
  await expect(header).toHaveAttribute("data-scroll-hidden", "false")
  await assertBelowHeader()

  // Header wrapping can change without navigation, for example after rotating a phone.
  const viewport = page.viewportSize()!
  await page.setViewportSize({ ...viewport, width: viewport.width === 320 ? 1280 : 320 })
  await assertBelowHeader()
  await page.evaluate(() => window.scrollBy({ top: 160, behavior: "instant" }))
  await expect(header).toHaveAttribute("data-scroll-hidden", "true")
  await assertBelowHeader()
  const search = toolbar.getByRole("searchbox")
  await search.evaluate((node) => node.focus({ preventScroll: true }))
  await expect(search).toBeFocused()
  await assertBelowHeader()

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }))
  await expect(header).toHaveAttribute("data-scroll-hidden", "false")
  await expect
    .poll(async () => {
      const navigation = (await header.boundingBox())!
      return (await toolbar.boundingBox())!.y - (navigation.y + navigation.height)
    })
    .toBeGreaterThanOrEqual(0)
  await toolbar.getByRole("button", { name: "Filters and sort" }).click()
  await expect(page.getByRole("dialog", { name: "Filters and sort" })).toBeVisible()
}
