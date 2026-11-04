import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import type { PostDocument } from "@/features/writing/types"

const imageOrigin = "https://images.example.com"
const videoOrigin = "https://www.youtube-nocookie.com"
const firstVideoId = "dQw4w9WgXcQ"
const secondVideoId = "aqz-KE-bpKQ"

async function editorFixture(page: Page) {
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
  await page.route(`${videoOrigin}/**`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><head><title>Video fixture</title></head><body><p>Video fixture</p></body></html>',
    })
  )
  await page.route(`${imageOrigin}/**`, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="green"/></svg>',
    })
  )
  await page.goto("/admin/posts/new")
  await expect(page.locator(".ProseMirror")).toBeVisible()
}

function formatting(page: Page) {
  return page.getByRole("toolbar", { name: "Formatting", exact: true })
}

async function insertVideo(page: Page, url: string, title: string) {
  await formatting(page).getByRole("button", { name: "Insert video", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Insert video", exact: true })
  await dialog.getByLabel("Video URL", { exact: true }).fill(url)
  await dialog.getByLabel("Video title", { exact: true }).fill(title)
  await dialog.getByRole("button", { name: "Insert video", exact: true }).click()
  await expect(dialog).not.toBeVisible()
}

async function savedDocument(page: Page): Promise<PostDocument> {
  await page.getByLabel("Title", { exact: true }).fill("Editor media browser fixture")
  await page.route("**/api/admin/posts", (route) =>
    route.fulfill({ status: 503, json: { error: "Save fixture" } })
  )
  const request = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/admin/posts" && request.method() === "POST"
  )
  await page.getByRole("button", { name: "Save", exact: true }).first().click()
  return (await request).postDataJSON().content as PostDocument
}

for (const [kind, url] of [
  ["watch", `https://www.youtube.com/watch?v=${firstVideoId}&t=30s`],
  ["share", `https://youtu.be/${firstVideoId}?si=browser-fixture`],
  ["shorts", `https://www.youtube.com/shorts/${firstVideoId}`],
] as const) {
  test(`inserts a supported YouTube ${kind} URL as a privacy embed between paragraphs`, async ({
    page,
  }) => {
    await editorFixture(page)
    const body = page.locator(".ProseMirror")
    await body.fill("Before the video")
    await page.keyboard.press("Enter")
    await insertVideo(page, url, "Browser video illustration")
    const frame = body.locator("[data-youtube-video] iframe")
    await expect(frame).toHaveCount(1)
    await expect(frame).toHaveAttribute(
      "src",
      new RegExp(`^${videoOrigin}/embed/${firstVideoId}(?:[?#]|$)`)
    )
    await expect(frame).toHaveAttribute("title", "Browser video illustration")
    await expect(body).toBeFocused()
    await page.keyboard.type("After the video")
    await expect(body).toContainText("Before the video")
    await expect(body).toContainText("After the video")
    await expect(frame).toHaveCount(1)
  })
}

test("edits video source and title, removes it independently, and restores it through Undo", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date())
  await editorFixture(page)
  const body = page.locator(".ProseMirror")
  await body.fill("A paragraph explaining the video.")
  await page.keyboard.press("Enter")
  await insertVideo(page, `https://youtu.be/${firstVideoId}`, "Original video title")
  const video = body.locator("[data-youtube-video]")
  await video.click()
  await formatting(page).getByRole("button", { name: "Edit video", exact: true }).click()
  const edit = page.getByRole("dialog", { name: "Edit video", exact: true })
  await expect(edit.getByLabel("Video title", { exact: true })).toHaveValue("Original video title")
  await edit
    .getByLabel("Video URL", { exact: true })
    .fill(`https://www.youtube.com/watch?v=${secondVideoId}`)
  await edit.getByLabel("Video title", { exact: true }).fill("Updated video title")
  await edit.getByRole("button", { name: "Update video", exact: true }).click()
  await expect(video.locator("iframe")).toHaveAttribute(
    "src",
    new RegExp(`/embed/${secondVideoId}(?:[?#]|$)`)
  )
  await expect(video.locator("iframe")).toHaveAttribute("title", "Updated video title")

  await video.click()
  await formatting(page).getByRole("button", { name: "Edit video", exact: true }).click()
  await edit.getByRole("button", { name: "Remove video", exact: true }).click()
  await expect(video).toHaveCount(0)
  await formatting(page).getByRole("button", { name: "Undo", exact: true }).click()
  await expect(video.locator("iframe")).toHaveAttribute("title", "Updated video title")
  await formatting(page).getByRole("button", { name: "Undo", exact: true }).click()
  await expect(video.locator("iframe")).toHaveAttribute("title", "Original video title")
  await expect(body).toContainText("A paragraph explaining the video.")
})

test("rejects unsupported video hosts and provides a responsive accessible mobile dialog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 })
  const framePolicyErrors: string[] = []
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Content Security Policy|frame-src|Refused to frame/i.test(message.text())
    )
      framePolicyErrors.push(message.text())
  })
  await editorFixture(page)
  await page.locator(".ProseMirror").fill("Mobile video example")
  await page.keyboard.press("Enter")
  await formatting(page).getByRole("button", { name: "Insert video", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Insert video", exact: true })
  for (const url of [
    "https://vimeo.com/123456",
    `https://youtube.com.evil.test/watch?v=${firstVideoId}`,
  ]) {
    await dialog.getByLabel("Video URL", { exact: true }).fill(url)
    await dialog.getByRole("button", { name: "Insert video", exact: true }).click()
    await expect(dialog.getByRole("alert")).toContainText(/YouTube/i)
    await expect(page.locator(".ProseMirror iframe")).toHaveCount(0)
  }
  await dialog.getByLabel("Video URL", { exact: true }).fill(`https://youtu.be/${firstVideoId}`)
  await dialog.getByLabel("Video title", { exact: true }).fill("Mobile video illustration")
  expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual(
    []
  )
  await dialog.getByRole("button", { name: "Insert video", exact: true }).click()
  const video = page.locator(".ProseMirror [data-youtube-video]")
  const frame = video.locator("iframe")
  await expect(frame).toBeVisible()
  const dimensions = (await frame.boundingBox())!
  expect(dimensions.width).toBeLessThanOrEqual(320)
  expect(dimensions.width / dimensions.height).toBeCloseTo(16 / 9, 1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expect(frame).toHaveAttribute("title", "Mobile video illustration")
  expect(framePolicyErrors).toEqual([])
})

test("aligns text, images and video independently and saves alignment without changing image size", async ({
  page,
}) => {
  await editorFixture(page)
  const body = page.locator(".ProseMirror")
  await body.fill("An aligned paragraph")
  for (const [label, alignment] of [
    ["Align center", "center"],
    ["Align right", "right"],
    ["Align left", "left"],
    ["Justify", "justify"],
  ]) {
    await formatting(page).getByRole("button", { name: label, exact: true }).click()
    await expect(body.locator("p").first()).toHaveAttribute("data-align", alignment)
  }
  await body.locator("p").first().click()
  await page.keyboard.press("End")
  await page.keyboard.press("Enter")
  await formatting(page).getByRole("button", { name: "Insert image", exact: true }).click()
  const imageDialog = page.getByRole("dialog", { name: "Insert image", exact: true })
  await imageDialog.getByLabel("Image URL", { exact: true }).fill(`${imageOrigin}/aligned.svg`)
  await imageDialog.getByLabel("Image alt text", { exact: true }).fill("Aligned illustration")
  await imageDialog.getByRole("button", { name: "Insert image", exact: true }).click()
  const image = body.locator("img")
  await expect(image).toHaveCSS("width", "400px")
  await expect(image).toHaveCSS("height", "200px")
  await image.click()
  const imageContainer = body.locator("[data-resize-container]")
  await formatting(page).getByRole("button", { name: "Align center", exact: true }).click()
  await expect(imageContainer).toHaveAttribute("data-align", "center")
  await formatting(page).getByRole("button", { name: "Align right", exact: true }).click()
  await expect(imageContainer).toHaveAttribute("data-align", "right")
  await expect(image).toHaveCSS("width", "400px")
  await expect(image).toHaveCSS("height", "200px")
  await expect(
    formatting(page).getByRole("button", { name: "Justify", exact: true })
  ).toBeDisabled()
  const rightEdge = await body.evaluate(
    (node) => node.getBoundingClientRect().right - parseFloat(getComputedStyle(node).paddingRight)
  )
  const imageBounds = (await image.boundingBox())!
  expect(Math.abs(imageBounds.x + imageBounds.width - rightEdge)).toBeLessThanOrEqual(1)
  const handle = body.locator('[data-resize-handle="bottom-right"]')
  await handle.focus()
  await page.keyboard.press("Shift+ArrowLeft")
  await expect(image).toHaveCSS("width", "390px")
  await expect(image).toHaveCSS("height", "195px")
  await expect(imageContainer).toHaveAttribute("data-align", "right")

  await body.locator("p").last().click()
  await insertVideo(page, `https://youtu.be/${firstVideoId}`, "Aligned video")
  const video = body.locator("[data-youtube-video]")
  await video.click()
  await formatting(page).getByRole("button", { name: "Align center", exact: true }).click()
  await expect(body.locator('[data-resize-container][data-node="youtube"]')).toHaveAttribute(
    "data-align",
    "center"
  )
  await expect(
    formatting(page).getByRole("button", { name: "Justify", exact: true })
  ).toBeDisabled()

  const document = await savedDocument(page)
  expect(document.content?.find((node) => node.type === "paragraph")?.attrs).toMatchObject({
    textAlign: "justify",
  })
  expect(document.content?.find((node) => node.type === "image")?.attrs).toMatchObject({
    textAlign: "right",
    width: 390,
    height: 195,
    alt: "Aligned illustration",
  })
  expect(document.content?.find((node) => node.type === "youtube")?.attrs).toMatchObject({
    title: "Aligned video",
    textAlign: "center",
  })
})

test("requires a video title and cancels without changing the article or submitting the post", async ({
  page,
}) => {
  await editorFixture(page)
  const body = page.locator(".ProseMirror")
  await body.fill("Keep this paragraph unchanged")
  let saves = 0
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/admin/posts" && request.method() === "POST")
      saves++
  })
  await formatting(page).getByRole("button", { name: "Insert video", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Insert video", exact: true })
  await dialog.getByLabel("Video URL", { exact: true }).fill(`https://youtu.be/${firstVideoId}`)
  await dialog.getByLabel("Video title", { exact: true }).fill("")
  await dialog.getByRole("button", { name: "Insert video", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText(/title/i)
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(body).toHaveText("Keep this paragraph unchanged")
  await expect(body.locator("iframe")).toHaveCount(0)
  await expect(
    formatting(page).getByRole("button", { name: "Insert video", exact: true })
  ).toBeFocused()
  expect(saves).toBe(0)
})

test("resizes video proportionally, aligns the player, and restores its custom size after full width", async ({
  page,
}) => {
  let playerLoads = 0
  page.on("request", (request) => {
    if (request.url().startsWith(`${videoOrigin}/embed/`)) playerLoads++
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await editorFixture(page)
  const body = page.locator(".ProseMirror")
  await body.fill("A resizable video between article blocks")
  await page.keyboard.press("Enter")
  await insertVideo(page, `https://youtu.be/${firstVideoId}`, "Resizable video")
  const video = body.locator('[data-resize-container][data-node="youtube"]')
  const frame = video.locator("iframe")
  await expect(frame).toBeVisible()
  await video.locator("[data-youtube-video]").click()
  const handle = video.locator('[data-resize-handle="bottom-right"]')
  await expect(handle).toBeVisible()
  const original = (await frame.boundingBox())!
  const handleBox = (await handle.boundingBox())!
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 - 120,
    handleBox.y + handleBox.height / 2 - 67.5,
    { steps: 12 }
  )
  await page.mouse.up()
  await expect.poll(async () => (await frame.boundingBox())!.width).toBeLessThan(original.width)
  const resized = (await frame.boundingBox())!
  expect(resized.width / resized.height).toBeCloseTo(16 / 9, 1)

  await formatting(page).getByRole("button", { name: "Align center", exact: true }).click()
  await expect(video).toHaveAttribute("data-align", "center")
  const bodyBox = (await body.boundingBox())!
  await expect
    .poll(async () => {
      const box = (await frame.boundingBox())!
      return Math.abs(box.x + box.width / 2 - (bodyBox.x + bodyBox.width / 2))
    })
    .toBeLessThanOrEqual(1)
  await formatting(page).getByRole("button", { name: "Align right", exact: true }).click()
  await expect(video).toHaveAttribute("data-align", "right")
  const contentRight = await body.evaluate(
    (node) => node.getBoundingClientRect().right - parseFloat(getComputedStyle(node).paddingRight)
  )
  await expect
    .poll(async () => {
      const box = (await frame.boundingBox())!
      return Math.abs(box.x + box.width - contentRight)
    })
    .toBeLessThanOrEqual(1)

  await video.locator("[data-youtube-video]").click()
  await formatting(page).getByRole("button", { name: "Edit video", exact: true }).click()
  const edit = page.getByRole("dialog", { name: "Edit video", exact: true })
  const fullWidth = edit.getByRole("checkbox", { name: "Full content width", exact: true })
  await expect(fullWidth).not.toBeChecked()
  await fullWidth.check()
  await edit.getByRole("button", { name: "Update video", exact: true }).click()
  const contentWidth = await body.evaluate(
    (node) =>
      node.clientWidth -
      parseFloat(getComputedStyle(node).paddingLeft) -
      parseFloat(getComputedStyle(node).paddingRight)
  )
  await expect
    .poll(async () => Math.abs((await frame.boundingBox())!.width - contentWidth))
    .toBeLessThanOrEqual(1)
  const fullDocument = await savedDocument(page)
  expect(fullDocument.content?.find((node) => node.type === "youtube")?.attrs).toMatchObject({
    fullWidth: true,
    textAlign: "right",
    title: "Resizable video",
  })

  await page.setViewportSize({ width: 320, height: 844 })
  await expect(frame).toBeVisible()
  const mobile = (await frame.boundingBox())!
  expect(mobile.width).toBeLessThanOrEqual(320)
  expect(mobile.width / mobile.height).toBeCloseTo(16 / 9, 1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)

  await page.setViewportSize({ width: 1440, height: 1000 })
  await video.locator("[data-youtube-video]").click()
  await formatting(page).getByRole("button", { name: "Edit video", exact: true }).click()
  await expect(fullWidth).toBeChecked()
  await fullWidth.uncheck()
  await edit.getByRole("button", { name: "Update video", exact: true }).click()
  await expect
    .poll(async () => Math.abs((await frame.boundingBox())!.width - resized.width))
    .toBeLessThanOrEqual(1)
  expect((await frame.boundingBox())!.width / (await frame.boundingBox())!.height).toBeCloseTo(
    16 / 9,
    1
  )
  const customDocument = await savedDocument(page)
  expect(customDocument.content?.find((node) => node.type === "youtube")?.attrs).toMatchObject({
    fullWidth: false,
    width: Math.round(resized.width),
    height: Math.round(resized.height),
  })
  expect(playerLoads).toBe(1)
})

test("supports touch resizing a full-width video and restores cancelled gestures", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await editorFixture(page)
  await insertVideo(page, `https://youtu.be/${firstVideoId}`, "Touch video")
  const video = page.locator('[data-resize-container][data-node="youtube"]')
  await video.locator("[data-youtube-video]").click()
  await formatting(page).getByRole("button", { name: "Edit video", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Edit video", exact: true })
  await dialog.getByRole("checkbox", { name: "Full content width", exact: true }).check()
  await dialog.getByRole("button", { name: "Update video", exact: true }).click()
  const frame = video.locator("iframe")
  const handle = video.locator('[data-resize-handle="bottom-right"]')
  await handle.scrollIntoViewIfNeeded()
  const bounds = (await handle.boundingBox())!
  const original = (await frame.boundingBox())!
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] })
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...point, x: point.x - 40 }],
  })
  await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] })
  await expect.poll(async () => (await frame.boundingBox())!.width).toBeCloseTo(original.width, 1)
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] })
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...point, x: point.x - 40 }],
  })
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  const resized = (await frame.boundingBox())!
  expect(resized.width).toBeLessThan(original.width)
  expect(resized.width / resized.height).toBeCloseTo(16 / 9, 1)
  await expect(video).toHaveAttribute("data-resize-state", "false")
  const saved = await savedDocument(page)
  expect(saved.content?.find((node) => node.type === "youtube")?.attrs).toMatchObject({
    fullWidth: false,
    width: Math.round(resized.width),
  })
  await cdp.detach()
})
