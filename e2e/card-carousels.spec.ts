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
      await expect(viewport).toHaveCSS("cursor", "grab")
      await expect(next).toHaveCSS("cursor", "pointer")
      const first = viewport.locator("[data-print-columns] > *").first()
      const initialLeft = (await first.boundingBox())!.x
      const navigation = page.getByRole("group", { name: `${title} carousel navigation` })
      const containerLeft = await navigation.evaluate(
        (node) => node.getBoundingClientRect().left + parseFloat(getComputedStyle(node).paddingLeft)
      )
      expect(Math.abs(initialLeft - containerLeft)).toBeLessThanOrEqual(1)

      await next.click()
      await expect(previous).toBeEnabled()
      await expect.poll(async () => (await first.boundingBox())!.x).toBeLessThan(initialLeft)
      expect((await viewport.boundingBox())!.x).toBeLessThanOrEqual(1)
      await expect.poll(async () => (await first.boundingBox())!.x).toBeLessThan(0)
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
      await expect
        .poll(async () => Math.abs((await first.boundingBox())!.x - initialLeft))
        .toBeLessThanOrEqual(1)
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
  await expect(viewport).toHaveCSS("cursor", "grabbing")
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

for (const width of [390, 1920]) {
  test(`aligns the first card before hydration and on refresh at ${width}px`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      javaScriptEnabled: false,
      viewport: { width, height: 900 },
    })
    const page = await context.newPage()
    try {
      await page.goto("/resume")
      for (const refresh of [false, true]) {
        if (refresh) await page.reload()
        for (const title of ["Tech Stack", "Portfolio"]) {
          const first = page
            .getByRole("region", { name: title, exact: true })
            .locator("[data-print-columns] > *")
            .first()
          const controls = page.locator(`[aria-label="${title} carousel navigation"]`)
          const expectedLeft = await controls.evaluate(
            (node) =>
              node.getBoundingClientRect().left + parseFloat(getComputedStyle(node).paddingLeft)
          )
          // No JavaScript is available to repair an edge-aligned initial render.
          expect(Math.abs((await first.boundingBox())!.x - expectedLeft)).toBeLessThanOrEqual(1)
        }
      }
    } finally {
      await context.close()
    }
  })
}

for (const width of [390, 768, 1440, 1920]) {
  test(`matches home Writing card sizing and feedback on both resume rails at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.route("**/api/writing/recent**", (route) =>
      route.fulfill({
        json: [
          {
            id: "carousel-consistency",
            slug: "carousel-consistency",
            title: "Carousel consistency",
            excerpt: "A writing card for comparison with the resume rails.",
            coverUrl: null,
            coverAlt: null,
            publishedAt: "2026-10-09T00:00:00Z",
            updatedAt: "2026-10-09T00:00:00Z",
            readingTime: 1,
            tags: [],
          },
        ],
      })
    )
    await page.goto("/")
    const writingCard = page
      .getByRole("region", { name: "Writing", exact: true })
      .locator("[data-print-columns] > *")
      .first()
    await expect(writingCard).toBeVisible()
    const writingBounds = (await writingCard.boundingBox())!
    await writingCard.hover()
    const hoverShadow = await writingCard.evaluate((node) => getComputedStyle(node).boxShadow)
    expect(hoverShadow).not.toBe("none")

    await page.goto("/resume")
    for (const title of ["Tech Stack", "Portfolio"]) {
      const viewport = page.getByRole("region", { name: title, exact: true })
      const card = viewport.locator("[data-print-columns] > *").first()
      const bounds = (await card.boundingBox())!
      expect(Math.abs(bounds.width - writingBounds.width)).toBeLessThanOrEqual(1)
      expect(Math.abs(bounds.x - writingBounds.x)).toBeLessThanOrEqual(1)
      await card.hover()
      await expect(card).toHaveCSS("box-shadow", hoverShadow)
      await page.mouse.move(0, 0)
      const details = card.getByRole("region")
      await details.focus()
      await expect(details).toBeFocused()
      await expect(card).toHaveCSS("box-shadow", hoverShadow)
      await expect(card).toHaveCSS("transition-property", "none")
      // Detail panes keep their own scroll keys instead of moving the carousel.
      const initialX = (await card.boundingBox())!.x
      await page.keyboard.press("ArrowRight")
      expect(Math.abs((await card.boundingBox())!.x - initialX)).toBeLessThanOrEqual(1)
    }
  })
}
