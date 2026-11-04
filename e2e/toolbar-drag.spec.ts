import { expect, test, type Page } from "@playwright/test"

async function newPost(page: Page) {
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: "browser-fixture",
      url: test.info().project.use.baseURL as string,
    },
  ])
  await page.route("**/api/admin/session", (route) =>
    route.fulfill({
      json: {
        author: { id: "fixture", name: "Author", email: "author@example.test" },
        authConfigured: true,
        databaseConfigured: true,
        coverUploadsConfigured: false,
        previewConfigured: true,
      },
    })
  )
  await page.route("**/api/admin/tags", (route) => route.fulfill({ json: [] }))
  await page.goto("/admin/posts/new")
  await expect(page.locator(".ProseMirror")).toBeVisible()
  return page.getByRole("toolbar", { name: "Formatting", exact: true })
}

test("drags formatting controls without activating the starting button, then allows a normal click", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const toolbar = await newPost(page)
  const body = page.locator(".ProseMirror")
  await body.fill("Keep the selection while browsing controls")
  const bold = toolbar.getByRole("button", { name: "Bold", exact: true })
  await expect(bold).toHaveAttribute("aria-pressed", "false")
  await expect(toolbar).toHaveCSS("scrollbar-width", "none")
  const rightCue = toolbar.locator("..").locator('[data-scroll-cue="right"]')
  const leftCue = toolbar.locator("..").locator('[data-scroll-cue="left"]')
  await expect(rightCue).toBeVisible()
  await expect(leftCue).toBeHidden()

  const start = (await bold.boundingBox())!
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x - 85, start.y + start.height / 2, { steps: 8 })
  await expect(toolbar).toHaveAttribute("data-dragging", "true")
  await page.mouse.up()
  await expect(toolbar).toHaveAttribute("data-dragging", "false")
  await expect.poll(() => toolbar.evaluate((node) => node.scrollLeft)).toBeGreaterThan(50)
  await expect(leftCue).toBeVisible()
  await expect(bold).toHaveAttribute("aria-pressed", "false")
  await expect(body.locator("strong")).toHaveCount(0)

  await bold.click()
  await expect(bold).toHaveAttribute("aria-pressed", "true")
  await expect(body).toBeFocused()
  await page.keyboard.type(" bold text")
  await expect(body.locator("strong")).toHaveText(" bold text")
})

test("supports keyboard boundaries and shows only the available overflow gradients", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 })
  const toolbar = await newPost(page)
  const cues = toolbar.locator("..")
  await toolbar.focus()
  await page.keyboard.press("End")
  await expect(cues.locator('[data-scroll-cue="left"]')).toBeVisible()
  await expect(cues.locator('[data-scroll-cue="right"]')).toBeHidden()
  await page.keyboard.press("Home")
  await expect.poll(() => toolbar.evaluate((node) => node.scrollLeft)).toBe(0)
  await expect(cues.locator('[data-scroll-cue="left"]')).toBeHidden()
  await expect(cues.locator('[data-scroll-cue="right"]')).toBeVisible()

  const video = toolbar.getByRole("button", { name: "Insert video", exact: true })
  await video.focus()
  await expect(video).toBeFocused()
  const bounds = (await video.boundingBox())!
  const viewport = (await toolbar.boundingBox())!
  expect(bounds.x).toBeGreaterThanOrEqual(viewport.x)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.x + viewport.width)
  await page.keyboard.press("Enter")
  await expect(page.getByRole("dialog", { name: "Insert video", exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(video).toBeFocused()
})

test("updates table toolbar overflow after resizing and ends cancelled pointer gestures", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 844 })
  const formatting = await newPost(page)
  await formatting.getByRole("button", { name: "Table", exact: true }).click()
  const table = page.getByRole("toolbar", { name: "Table editing", exact: true })
  await expect(table).toBeVisible()
  const cues = table.locator("..")
  await expect(cues.locator('[data-scroll-cue="left"]')).toBeHidden()
  await expect(cues.locator('[data-scroll-cue="right"]')).toBeHidden()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(cues.locator('[data-scroll-cue="right"]')).toBeVisible()
  const bounds = (await table.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width - 25, bounds.y + bounds.height - 4)
  await page.mouse.down()
  await page.mouse.move(bounds.x + 45, bounds.y + bounds.height - 4, { steps: 8 })
  await expect(table).toHaveAttribute("data-dragging", "true")
  await table.dispatchEvent("pointercancel", { pointerId: 1, pointerType: "mouse" })
  await expect(table).toHaveAttribute("data-dragging", "false")
  const cancelledLeft = await table.evaluate((node) => node.scrollLeft)
  await page.mouse.move(bounds.x + 20, bounds.y + bounds.height - 4)
  await page.mouse.up()
  expect(await table.evaluate((node) => node.scrollLeft)).toBe(cancelledLeft)
  await expect(page.locator(".ProseMirror table")).toHaveCount(1)
})

test("keeps native touch scrolling on formatting controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const toolbar = await newPost(page)
  const bounds = (await toolbar.boundingBox())!
  const cdp = await page.context().newCDPSession(page)
  const y = bounds.y + bounds.height - 3
  const x = bounds.x + bounds.width - 25
  try {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    })
    for (let step = 1; step <= 6; step += 1)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x - step * 35, y }],
      })
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    await expect.poll(() => toolbar.evaluate((node) => node.scrollLeft)).toBeGreaterThan(50)
    await expect(toolbar).toHaveAttribute("data-dragging", "false")
  } finally {
    await cdp.detach()
  }
})
