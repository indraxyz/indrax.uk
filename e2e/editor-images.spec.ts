import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1X8AAAAASUVORK5CYII=",
  "base64"
)
const imageOrigin = "https://images.example.com"

async function editorFixture(page: Page, uploadsConfigured = true) {
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
        coverUploadsConfigured: uploadsConfigured,
        previewConfigured: true,
      },
    })
  )
  await page.route("**/api/admin/tags", (route) => route.fulfill({ json: [] }))
  await page.route(`${imageOrigin}/**`, (route) =>
    route.fulfill({ contentType: "image/png", body: png })
  )
  await page.goto("/admin/posts/new")
  await expect(page.locator(".ProseMirror")).toBeVisible()
}

async function openInsert(page: Page) {
  await page
    .getByRole("toolbar", { name: "Formatting", exact: true })
    .getByRole("button", { name: "Insert image", exact: true })
    .click()
  const dialog = page.getByRole("dialog", { name: "Insert image", exact: true })
  await expect(dialog).toBeVisible()
  return dialog
}

test("resizes proportionally by drag and keyboard, saves dimensions and fits a mobile column", async ({
  page,
}) => {
  await editorFixture(page)
  await page.route(`${imageOrigin}/resize.svg`, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="green"/></svg>',
    })
  )
  const dialog = await openInsert(page)
  await dialog.getByLabel("Image URL", { exact: true }).fill(`${imageOrigin}/resize.svg`)
  await dialog.getByLabel("Image alt text", { exact: true }).fill("Resizable illustration")
  await dialog.getByRole("button", { name: "Insert image", exact: true }).click()
  const image = page.locator(".ProseMirror img")
  await expect(image).toBeVisible()
  await image.click()
  const handle = page.locator('[data-resize-handle="bottom-right"]')
  await expect(handle).toBeVisible()
  const bounds = (await handle.boundingBox())!
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2 - 100, bounds.y + bounds.height / 2 - 50, {
    steps: 10,
  })
  await page.mouse.up()
  await expect(image).toHaveCSS("width", "300px")
  await expect(image).toHaveCSS("height", "150px")

  await handle.focus()
  await page.keyboard.press("Shift+ArrowRight")
  await expect(image).toHaveCSS("width", "310px")
  await expect(image).toHaveCSS("height", "155px")
  expect((await new AxeBuilder({ page }).include(".ProseMirror").analyze()).violations).toEqual([])
  await page.getByRole("button", { name: "Undo", exact: true }).click()
  await expect(image).toHaveCSS("width", "300px")
  await page.getByRole("button", { name: "Redo", exact: true }).click()
  await expect(image).toHaveCSS("width", "310px")
  await page.getByLabel("Title", { exact: true }).fill("Resized image")
  await page.route("**/api/admin/posts", (route) =>
    route.fulfill({ status: 503, json: { error: "Save fixture" } })
  )
  const request = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/admin/posts" && request.method() === "POST"
  )
  await page.getByRole("button", { name: "Save", exact: true }).first().click()
  const saved = (await request).postDataJSON()
  expect(
    saved.content.content.find((node: { type: string }) => node.type === "image").attrs
  ).toMatchObject({
    width: 310,
    height: 155,
    alt: "Resizable illustration",
  })

  await page.setViewportSize({ width: 320, height: 844 })
  const mobile = (await image.boundingBox())!
  expect(mobile.width).toBeLessThan(310)
  expect(mobile.width / mobile.height).toBeCloseTo(2, 1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test("commits touch resizing, cancels safely and keeps short wide images inside mobile columns", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await editorFixture(page)
  await page.route(`${imageOrigin}/panorama.svg`, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="200"><rect width="1000" height="200" fill="green"/></svg>',
    })
  )
  const dialog = await openInsert(page)
  await dialog.getByLabel("Image URL", { exact: true }).fill(`${imageOrigin}/panorama.svg`)
  await dialog.getByRole("button", { name: "Insert image", exact: true }).click()
  const image = page.locator(".ProseMirror img")
  await expect(image).toBeVisible()
  await image.click()
  const handle = page.locator('[data-resize-handle="bottom-right"]')
  await expect(handle).toBeVisible()
  await handle.scrollIntoViewIfNeeded()
  const bounds = (await handle.boundingBox())!
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  const initial = (await image.boundingBox())!
  const cdp = await page.context().newCDPSession(page)
  const touch = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touch] })
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...touch, x: touch.x - 30 }],
  })
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] })
  await expect.poll(async () => (await image.boundingBox())!.width).toBeCloseTo(initial.width, 2)
  await expect(page.locator("[data-resize-container]")).toHaveAttribute(
    "data-resize-state",
    "false"
  )
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touch] })
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...touch, x: touch.x - 30 }],
  })
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  // Touch completion must update the saved node as well as the displayed image.
  const resized = (await image.boundingBox())!
  expect(resized.width).toBeLessThan(initial.width)
  expect(resized.width / resized.height).toBeCloseTo(5, 0)
  await page.getByRole("button", { name: "Undo", exact: true }).click()
  await expect.poll(async () => (await image.boundingBox())!.width).toBeCloseTo(initial.width, 2)
  await expect(page.locator("[data-resize-container]")).toHaveAttribute(
    "data-resize-state",
    "false"
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await cdp.detach()
})

test("keeps rapid image actions separate in Undo history", async ({ page }) => {
  // Identical transaction timestamps reproduce history grouping on fast CI runs.
  // Timers and animation frames still run normally.
  await page.clock.setFixedTime(new Date())
  await editorFixture(page)
  const body = page.locator(".ProseMirror")
  await body.fill("Paragraph before the image")
  await page.keyboard.press("Enter")
  const insert = await openInsert(page)
  await insert.getByLabel("Image URL", { exact: true }).fill(`${imageOrigin}/history.png`)
  await insert.getByLabel("Image alt text", { exact: true }).fill("Original illustration")
  await insert.getByRole("button", { name: "Insert image", exact: true }).click()
  await expect(body.locator("img")).toHaveCount(1)
  await body.locator("img").click()
  await page.getByRole("button", { name: "Edit image", exact: true }).click()
  const edit = page.getByRole("dialog", { name: "Edit image", exact: true })
  await edit.getByRole("button", { name: "Remove image", exact: true }).click()
  await expect(body.locator("img")).toHaveCount(0)
  await page.getByRole("button", { name: "Undo", exact: true }).click()
  await expect(body.locator("img")).toHaveAttribute("alt", "Original illustration")
  await page.getByRole("button", { name: "Undo", exact: true }).click()
  await expect(body.locator("img")).toHaveCount(0)
  await expect(body).toContainText("Paragraph before the image")
  await page.getByRole("button", { name: "Redo", exact: true }).click()
  await expect(body.locator("img")).toHaveCount(1)
  await page.getByRole("button", { name: "Redo", exact: true }).click()
  await expect(body.locator("img")).toHaveCount(0)
  await page.getByRole("button", { name: "Undo", exact: true }).click()
  await expect(body.locator("img")).toHaveCount(1)
  await body.locator("img").click()
  await page.getByRole("button", { name: "Edit image", exact: true }).click()
  await edit.getByLabel("Image alt text", { exact: true }).fill("Updated illustration")
  await edit.getByRole("button", { name: "Update image", exact: true }).click()
  await page.getByRole("button", { name: "Undo", exact: true }).click()
  await expect(body.locator("img")).toHaveAttribute("alt", "Original illustration")
  await page.getByRole("button", { name: "Redo", exact: true }).click()
  await expect(body.locator("img")).toHaveAttribute("alt", "Updated illustration")
  await body.locator("p").last().click()
  await page.keyboard.type("Text after the image")
  await page.getByRole("button", { name: "Undo", exact: true }).click()
  await expect(body.locator("img")).toHaveAttribute("alt", "Updated illustration")
  await expect(body).not.toContainText("Text after the image")
  await expect(body).toContainText("Paragraph before the image")
})

test("inserts multiple images between paragraphs, edits alt text and removes only the selected image", async ({
  page,
}) => {
  await editorFixture(page)
  const body = page.locator(".ProseMirror")
  await body.fill("First paragraph")
  await page.keyboard.press("Enter")
  let dialog = await openInsert(page)
  await dialog.getByLabel("Image URL", { exact: true }).fill(`${imageOrigin}/first.png`)
  await dialog.getByLabel("Image alt text", { exact: true }).fill("First illustration")
  await dialog.getByRole("button", { name: "Insert image", exact: true }).click()
  await expect(body.locator("img")).toHaveCount(1)
  await expect(body).toBeFocused()
  await page.keyboard.type("Middle paragraph")
  await page.keyboard.press("Enter")
  dialog = await openInsert(page)
  await dialog.getByLabel("Image URL", { exact: true }).fill(`${imageOrigin}/second.png`)
  await dialog.getByLabel("Image alt text", { exact: true }).fill("Second illustration")
  await dialog.getByRole("button", { name: "Insert image", exact: true }).click()
  await page.keyboard.type("Last paragraph")
  await expect(body.locator(":scope > *")).toHaveText([
    "First paragraph",
    "",
    "Middle paragraph",
    "",
    "Last paragraph",
  ])
  await expect(body.locator("img").nth(0)).toHaveAttribute("alt", "First illustration")
  await expect(body.locator("img").nth(1)).toHaveAttribute("alt", "Second illustration")

  await body.locator("img").first().click()
  await page.getByRole("button", { name: "Edit image", exact: true }).click()
  const edit = page.getByRole("dialog", { name: "Edit image", exact: true })
  await expect(edit.getByLabel("Image alt text", { exact: true })).toHaveValue("First illustration")
  await edit.getByLabel("Image alt text", { exact: true }).fill("Updated first illustration")
  await edit.getByRole("button", { name: "Update image", exact: true }).click()
  await expect(body.locator("img").first()).toHaveAttribute("alt", "Updated first illustration")
  await expect(body.locator("img").nth(1)).toHaveAttribute("alt", "Second illustration")

  await page.getByRole("button", { name: "Edit image", exact: true }).click()
  await edit.getByRole("button", { name: "Remove image", exact: true }).click()
  await expect(body.locator("img")).toHaveCount(1)
  await expect(body.locator("img")).toHaveAttribute("alt", "Second illustration")
  await page.getByRole("button", { name: "Undo", exact: true }).click()
  await expect(body.locator("img")).toHaveCount(2)
  await expect(
    page.getByRole("group", { name: "Cover image", exact: true }).locator("img")
  ).toHaveCount(0)
})

test("retains a failed content upload for retry and blocks dismissal during the upload", async ({
  page,
}) => {
  await editorFixture(page)
  const body = page.locator(".ProseMirror")
  await body.fill("Paragraph before the image")
  await page.keyboard.press("Enter")
  const dialog = await openInsert(page)
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "illustration.png",
    mimeType: "image/png",
    buffer: png,
  })
  await dialog.getByLabel("Image alt text", { exact: true }).fill("Uploaded illustration")
  let uploads = 0
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/upload?purpose=content", async (route) => {
    uploads++
    expect(route.request().headers()["content-type"]).toBe("image/png")
    if (uploads === 1) {
      await route.fulfill({ status: 503, json: { error: "Temporary image upload failure" } })
    } else {
      await held
      await route.fulfill({ status: 201, json: { publicUrl: `${imageOrigin}/uploaded.png` } })
    }
  })
  await dialog.getByRole("button", { name: "Insert image", exact: true }).click()
  await expect(dialog.getByRole("alert")).toHaveText("Temporary image upload failure")
  await expect(dialog.getByRole("img", { name: "Selected image preview" })).toBeVisible()
  await expect(body.locator("img")).toHaveCount(0)
  await dialog.getByRole("button", { name: "Insert image", exact: true }).click()
  try {
    await expect(dialog.getByRole("button", { name: "Uploading…", exact: true })).toBeDisabled()
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled()
    await page.keyboard.press("Escape")
    await expect(dialog).toBeVisible()
  } finally {
    release()
  }
  await expect(dialog).not.toBeVisible()
  await expect(body.locator("img")).toHaveAttribute("src", `${imageOrigin}/uploaded.png`)
  await expect(body.locator("img")).toHaveAttribute("alt", "Uploaded illustration")
  expect(uploads).toBe(2)
  // Inserting an image updates only the local document; Save remains a separate action.
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("")
  await expect(page.getByRole("alert")).toHaveCount(0)
})

test("supports image URLs without storage and keeps the dialog accessible on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await editorFixture(page, false)
  await page.locator(".ProseMirror").click()
  const dialog = await openInsert(page)
  await expect(dialog.getByRole("button", { name: "Upload a content image" })).toBeDisabled()
  await expect(dialog).toContainText("Uploads are unavailable until media storage is configured")
  await dialog.getByLabel("Image URL", { exact: true }).fill("javascript:alert(1)")
  await dialog.getByRole("button", { name: "Insert image", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText("Use an HTTPS image URL")
  await dialog.getByLabel("Image URL", { exact: true }).fill(`${imageOrigin}/decorative.png`)
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    []
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await dialog.getByRole("button", { name: "Insert image", exact: true }).click()
  await expect(page.locator(".ProseMirror img")).toHaveAttribute("alt", "")
})

test("cancels without changing the document and rejects unsupported or oversized files", async ({
  page,
}) => {
  await editorFixture(page)
  const body = page.locator(".ProseMirror")
  await body.fill("Unchanged paragraph")
  const dialog = await openInsert(page)
  const picker = dialog.locator('input[type="file"]')
  await picker.setInputFiles({
    name: "unsafe.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  })
  await expect(dialog.getByRole("alert")).toContainText("Images only")
  await picker.setInputFiles({
    name: "large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
  })
  await expect(dialog.getByRole("alert")).toContainText("larger than 5MB")
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(body).toHaveText("Unchanged paragraph")
  await expect(body.locator("img")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Insert image", exact: true })).toBeFocused()
})
