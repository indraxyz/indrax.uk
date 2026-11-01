import { expect, test } from "@playwright/test"

for (const width of [390, 1440]) {
  test(`navigates resume card carousels with bottom-right arrows at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/resume")

    for (const title of ["Tech Stack", "Portfolio"]) {
      const viewport = page.getByRole("region", { name: title, exact: true })
      const previous = page.getByRole("button", { name: `Previous ${title} cards` })
      const next = page.getByRole("button", { name: `Next ${title} cards` })
      await expect(viewport).toHaveAttribute("aria-roledescription", "carousel")
      await expect(previous).toBeDisabled()
      await expect(next).toBeEnabled()
      const first = viewport.locator("[data-print-columns] > *").first()
      const initialLeft = (await first.boundingBox())!.x

      await next.click()
      await expect(previous).toBeEnabled()
      await expect.poll(async () => (await first.boundingBox())!.x).toBeLessThan(initialLeft)
      const bounds = (await viewport.boundingBox())!
      const arrow = (await next.boundingBox())!
      expect(arrow.y).toBeGreaterThanOrEqual(bounds.y + bounds.height)
      expect(arrow.x + arrow.width).toBeLessThanOrEqual(bounds.x + bounds.width)
      expect(arrow.x + arrow.width).toBeGreaterThan(bounds.x + bounds.width / 2)

      await viewport.focus()
      await page.keyboard.press("End")
      await expect(next).toBeDisabled()
      await previous.click()
      await expect(next).toBeEnabled()
      await viewport.focus()
      await page.keyboard.press("Home")
      await expect(previous).toBeDisabled()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      )
    }
  })
}

test("supports dragging, resizing, and printing a navigated carousel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 })
  await page.goto("/resume")
  const viewport = page.getByRole("region", { name: "Tech Stack", exact: true })
  const next = page.getByRole("button", { name: "Next Tech Stack cards" })
  await expect(next).toBeEnabled()
  await viewport.scrollIntoViewIfNeeded()
  const first = viewport.locator("[data-print-columns] > *").first()
  const initialLeft = (await first.boundingBox())!.x
  const bounds = (await viewport.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width - 30, bounds.y + 30)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 30, bounds.y + 30, { steps: 12 })
  await page.mouse.up()
  await expect.poll(async () => (await first.boundingBox())!.x).toBeLessThan(initialLeft)

  await page.setViewportSize({ width: 1440, height: 900 })
  await viewport.focus()
  await page.keyboard.press("End")
  await expect(next).toBeDisabled()
  await page.emulateMedia({ media: "print" })
  await expect(next).toBeHidden()
  expect(
    await viewport
      .locator("[data-print-columns]")
      .evaluate((node) => getComputedStyle(node).transform)
  ).toBe("none")
  expect(
    await viewport
      .locator("[data-print-columns]")
      .evaluate((node) => getComputedStyle(node).columnCount)
  ).toBe("2")
})

test("keeps resume cards reachable with native scrolling when JavaScript is disabled", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 390, height: 900 },
  })
  const page = await context.newPage()
  try {
    await page.goto("/resume")
    const viewport = page.getByRole("region", { name: "Tech Stack", exact: true })
    await expect(viewport).toHaveAttribute("tabindex", "0")
    expect(await viewport.evaluate((node) => getComputedStyle(node).overflowX)).toBe("auto")
    await viewport.focus()
    await page.keyboard.press("ArrowRight")
    await expect.poll(() => viewport.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0)
    await expect(page.getByRole("button", { name: "Next Tech Stack cards" })).toBeHidden()
  } finally {
    await context.close()
  }
})
