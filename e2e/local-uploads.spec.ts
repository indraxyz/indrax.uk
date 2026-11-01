import { expect, test, type BrowserContext } from "@playwright/test"
import { neon } from "@neondatabase/serverless"
import { E2E_BASE_URL } from "./support/constants"
import { mintAuthorSession, revokeAuthorSession, SESSION_COOKIE_SECURE } from "./support/session"
import { isLocalMediaUrl, LOCAL_MEDIA_PREFIX } from "../lib/uploads/local-media"

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1X8AAAAASUVORK5CYII=",
  "base64"
)
let author: BrowserContext
let authorId = ""
let bucketName = ""
const posts: string[] = []
const covers: string[] = []
const uploadedKeys = new Set<string>()

function localUploadKey(url: string): string {
  expect(isLocalMediaUrl(url)).toBe(true)
  return new URL(url).pathname.slice(LOCAL_MEDIA_PREFIX.length)
}

function rememberUpload(url: string) {
  uploadedKeys.add(localUploadKey(url))
  covers.push(url)
}

function uploadDatabase() {
  const url = process.env.DATABASE_URL!
  expect(["localhost", "127.0.0.1", "[::1]"]).toContain(new URL(url).hostname)
  return neon(url)
}

async function expectUploadState(url: string, expected: "pending" | "attached" | "deleted") {
  const sql = uploadDatabase()
  const key = localUploadKey(url)
  const rows = await sql`SELECT state FROM media_uploads WHERE key = ${key} AND url = ${url}`
  expect(rows).toEqual([{ state: expected }])
}

test.beforeAll(async ({ browser, request }) => {
  // Match the throwaway fixtures used by the isolated dev server, not .env.local.
  process.env.DATABASE_URL ??= "postgres://indrax:indrax@127.0.0.1:4444/indrax?sslmode=require"
  process.env.BETTER_AUTH_SECRET = "local-upload-test-secret-00000000000000000000"
  process.env.ALLOWED_GITHUB_ID = "1"
  const session = await mintAuthorSession()
  authorId = session.userId
  author = await browser.newContext()
  await author.addCookies([
    {
      name: SESSION_COOKIE_SECURE.replace("__Secure-", ""),
      value: session.cookieValue,
      domain: new URL(E2E_BASE_URL).hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Strict",
      secure: false,
    },
  ])
  const response = await request.get("/cdn-cgi/local/explorer/api/r2/buckets")
  const { result } = await response.json()
  expect(result.buckets).toHaveLength(1)
  bucketName = result.buckets[0].name
  expect(bucketName).toMatch(/^indrax-upload-browser-[0-9a-f-]{36}$/)
})

test.afterAll(async ({ request }) => {
  try {
    const cleanup = await Promise.allSettled([
      ...posts.map(async (id) => {
        const deleted = await author.request.delete(`${E2E_BASE_URL}/api/admin/posts/${id}`, {
          data: {},
          headers: { Origin: E2E_BASE_URL },
        })
        expect(deleted.ok()).toBe(true)
      }),
      ...covers.map(async (path) => {
        expect(isLocalMediaUrl(path)).toBe(true)
        const key = new URL(path).pathname.slice(LOCAL_MEDIA_PREFIX.length)
        const deleted = await request.delete(
          `/cdn-cgi/local/explorer/api/r2/buckets/${bucketName}/objects/${encodeURIComponent(key)}`
        )
        expect(deleted.ok()).toBe(true)
        expect((await request.get(path)).status()).toBe(404)
      }),
    ])
    for (const result of cleanup) if (result.status === "rejected") throw result.reason
    if (uploadedKeys.size > 0) {
      const sql = uploadDatabase()
      await sql`DELETE FROM media_uploads WHERE key = ANY(${[...uploadedKeys]}::text[])`
    }
  } finally {
    await Promise.all([
      author?.close(),
      authorId ? revokeAuthorSession(authorId) : Promise.resolve(),
    ])
  }
})

test("enables configured local cover uploads, saves a draft and displays the image", async ({
  browser,
  request,
}) => {
  test.setTimeout(60_000)
  const page = await author.newPage()
  await page.goto(`${E2E_BASE_URL}/admin/posts/new`)
  const cover = page.getByRole("group", { name: "Cover image", exact: true })
  await expect(cover.getByRole("button", { name: "Upload a cover" })).toBeEnabled()
  await expect(cover).not.toContainText("unavailable")
  await expect(cover.getByText("Cover changes take effect when you save the post.")).toBeVisible()
  const writes: string[] = []
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname
    if (request.method() === "POST" && ["/api/upload", "/api/admin/posts"].includes(path))
      writes.push(path)
  })
  await cover
    .locator('input[type="file"]')
    .setInputFiles({ name: "discard.png", mimeType: "image/png", buffer: png })
  const previewImage = cover.locator("img")
  await expect(previewImage).toBeVisible()
  await expect
    .poll(() => previewImage.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBe(1)
  await expect(cover.getByLabel("Cover image URL")).toHaveValue("")
  const removeCover = cover.getByRole("button", { name: "Remove cover image" })
  const buttonBox = await removeCover.boundingBox()
  const iconBox = await removeCover.locator("svg").boundingBox()
  expect(
    Math.abs(buttonBox!.x + buttonBox!.width / 2 - iconBox!.x - iconBox!.width / 2)
  ).toBeLessThan(1)
  expect(
    Math.abs(buttonBox!.y + buttonBox!.height / 2 - iconBox!.y - iconBox!.height / 2)
  ).toBeLessThan(1)
  await removeCover.click()
  const removeDialog = page.getByRole("alertdialog", { name: "Remove cover image?", exact: true })
  await expect(removeDialog).toContainText("when you save")
  await removeDialog.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(previewImage).toBeVisible()
  await removeCover.click()
  await removeDialog.getByRole("button", { name: "Remove cover", exact: true }).click()
  await expect(previewImage).toHaveCount(0)
  expect(writes).toEqual([])
  await cover
    .locator('input[type="file"]')
    .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png })
  await expect(previewImage).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect
    .poll(() =>
      previewImage.evaluate((image) =>
        Math.abs(image.getBoundingClientRect().width - image.parentElement!.clientWidth)
      )
    )
    .toBeLessThan(1)
  const imageBox = await previewImage.boundingBox()
  expect(imageBox!.height).toBeCloseTo(imageBox!.width, 0)
  await page.screenshot({ path: "test-results-uploads/cover-preview-mobile.png", fullPage: true })
  expect(writes).toEqual([])
  const uploaded = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/upload"
  )
  await cover.getByLabel("Cover alt text").fill("Local browser test cover")
  await page
    .getByLabel("Title", { exact: true })
    .fill(`Local upload regression ${crypto.randomUUID()}`)
  await page.locator(".ProseMirror").fill("A local upload test article.")
  const saved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/admin/posts" &&
      response.request().method() === "POST"
  )
  await page.getByRole("button", { name: "Save", exact: true }).click()
  const response = await uploaded
  expect(response.status()).toBe(201)
  const { publicUrl } = await response.json()
  rememberUpload(publicUrl)
  const outcome = await (await saved).json()
  expect(outcome.ok).toBe(true)
  posts.push(outcome.postId)
  await expectUploadState(publicUrl, "attached")
  expect(writes).toEqual(["/api/upload", "/api/admin/posts"])
  await expect(page).toHaveURL(`${E2E_BASE_URL}/admin/posts/edit/${outcome.postId}`)
  await expect(cover.getByLabel("Cover image URL")).toHaveValue(publicUrl)
  await expect(cover.locator("img")).toHaveAttribute("src", publicUrl)
  const preview = await author.request.post(
    `${E2E_BASE_URL}/api/admin/posts/${outcome.postId}/preview`,
    { data: {}, headers: { Origin: E2E_BASE_URL } }
  )
  const { url } = await preview.json()
  const previewUrl = new URL(url, E2E_BASE_URL)
  const slug = previewUrl.pathname.split("/").at(-2)
  const previewData = await request.get(`/api/writing/preview/${slug}`, {
    params: { token: previewUrl.searchParams.get("token")! },
  })
  expect(previewData.status()).toBe(200)
  expect((await previewData.json()).post.coverUrl).toBe(publicUrl)
  const reader = await browser.newPage()
  await reader.goto(publicUrl)
  const image = reader.locator("img").first()
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(1)
  await reader.close()
  // Removing a persisted cover affects only this form until the next save.
  await cover.getByRole("button", { name: "Remove cover image" }).click()
  await page
    .getByRole("alertdialog", { name: "Remove cover image?", exact: true })
    .getByRole("button", { name: "Remove cover", exact: true })
    .click()
  await expect(cover.locator("img")).toHaveCount(0)
  await expect(cover.getByLabel("Cover image URL")).toHaveValue("")
  expect(writes).toHaveLength(2)
  const beforeSave = await author.request.get(`${E2E_BASE_URL}/api/admin/posts/${outcome.postId}`)
  expect((await beforeSave.json()).coverUrl).toBe(publicUrl)
  expect((await request.get(publicUrl)).status()).toBe(200)
  const removed = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/admin/posts" &&
      response.request().method() === "POST"
  )
  await page.getByRole("button", { name: "Save", exact: true }).click()
  expect((await (await removed).json()).ok).toBe(true)
  const afterSave = await author.request.get(`${E2E_BASE_URL}/api/admin/posts/${outcome.postId}`)
  expect((await afterSave.json()).coverUrl).toBeNull()
  expect(writes).toEqual(["/api/upload", "/api/admin/posts", "/api/admin/posts"])
  expect((await request.get(publicUrl)).status()).toBe(404)
  await expectUploadState(publicUrl, "deleted")
  covers.splice(covers.indexOf(publicUrl), 1)
  await page.close()
})

test("retains a selected cover after failures and deletes its stored image with the post", async ({
  request,
}) => {
  test.setTimeout(60_000)
  const page = await author.newPage()
  await page.goto(`${E2E_BASE_URL}/admin/posts/new`)
  const cover = page.getByRole("group", { name: "Cover image", exact: true })
  await page.getByLabel("Title", { exact: true }).fill(`Cover retry ${crypto.randomUUID()}`)
  await page.locator(".ProseMirror").fill("A cover retry test article.")
  await cover
    .locator('input[type="file"]')
    .setInputFiles({ name: "retry.png", mimeType: "image/png", buffer: png })
  await cover.getByLabel("Cover alt text").fill("Retry test cover")
  let uploads = 0
  let saves = 0
  await page.route("**/api/upload?purpose=cover", async (route) => {
    uploads++
    if (uploads === 1)
      await route.fulfill({ status: 503, json: { error: "Upload temporarily unavailable" } })
    else await route.continue()
  })
  await page.route("**/api/admin/posts", async (route) => {
    if (route.request().method() !== "POST") return route.continue()
    saves++
    if (saves === 1)
      await route.fulfill({
        status: 400,
        json: { ok: false, message: "Save temporarily unavailable" },
      })
    else await route.continue()
  })
  const saveButton = page.getByRole("button", { name: "Save", exact: true })
  await saveButton.click()
  await expect(page.getByRole("alert")).toContainText("Upload temporarily unavailable")
  await expect(cover.locator("img")).toHaveAttribute("src", /^blob:/)
  expect(saves).toBe(0)
  const uploaded = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/upload" && response.status() === 201
  )
  await saveButton.click()
  const { publicUrl } = await (await uploaded).json()
  rememberUpload(publicUrl)
  await expect(page.getByRole("alert")).toContainText("Save temporarily unavailable")
  await expect(cover.locator("img")).toHaveAttribute("src", publicUrl)
  await expectUploadState(publicUrl, "pending")
  expect(uploads).toBe(2)
  const saved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/admin/posts" && response.status() === 200
  )
  await saveButton.click()
  const outcome = await (await saved).json()
  expect(outcome.ok).toBe(true)
  posts.push(outcome.postId)
  await expectUploadState(publicUrl, "attached")
  expect(uploads).toBe(2)
  expect(saves).toBe(2)
  expect((await request.get(publicUrl)).status()).toBe(200)
  const deleted = await author.request.delete(`${E2E_BASE_URL}/api/admin/posts/${outcome.postId}`, {
    data: {},
    headers: { Origin: E2E_BASE_URL },
  })
  expect((await deleted.json()).ok).toBe(true)
  expect((await request.get(publicUrl)).status()).toBe(404)
  await expectUploadState(publicUrl, "deleted")
  posts.splice(posts.indexOf(outcome.postId), 1)
  covers.splice(covers.indexOf(publicUrl), 1)
  await page.close()
})

test("redirects to sign-in when author access expires during a deferred upload", async ({
  browser,
}) => {
  const context = await browser.newContext()
  await context.addCookies(await author.cookies())
  const page = await context.newPage()
  page.on("dialog", (dialog) => void dialog.accept())
  try {
    await page.goto(`${E2E_BASE_URL}/admin/posts/new`)
    await page
      .getByRole("group", { name: "Cover image", exact: true })
      .locator('input[type="file"]')
      .setInputFiles({ name: "expired.png", mimeType: "image/png", buffer: png })
    await page.getByLabel("Title", { exact: true }).fill("Expired upload test")
    await context.clearCookies()
    const refused = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/upload"
    )
    await page.getByRole("button", { name: "Save", exact: true }).click()
    expect((await refused).status()).toBe(401)
    await expect(page).toHaveURL(`${E2E_BASE_URL}/admin/login`)
    await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0)
  } finally {
    await context.close()
  }
})

test("refuses unauthorized, cross-origin, malformed and oversized uploads", async ({ request }) => {
  const headers = { "Content-Type": "image/png", Origin: E2E_BASE_URL }
  expect((await request.post("/api/upload?purpose=cover", { headers, data: png })).status()).toBe(
    401
  )
  const endpoint = `${E2E_BASE_URL}/api/upload?purpose=cover`
  expect(
    (
      await author.request.post(endpoint, {
        headers: { ...headers, Origin: "https://evil.invalid" },
        data: png,
      })
    ).status()
  ).toBe(403)
  expect(
    (
      await author.request.post(endpoint, { headers, data: Buffer.from("<script>bad</script>") })
    ).status()
  ).toBe(415)
  expect(
    (
      await author.request.post(endpoint, { headers, data: Buffer.alloc(5 * 1024 * 1024 + 1) })
    ).status()
  ).toBe(413)
})

test("uploads multiple inline images, persists their alt text and renders them independently of the cover", async ({
  browser,
  request,
}) => {
  test.setTimeout(90_000)
  const page = await author.newPage()
  await page.goto(`${E2E_BASE_URL}/admin/posts/new`)
  await page.getByLabel("Title", { exact: true }).fill(`Inline images ${crypto.randomUUID()}`)
  const body = page.locator(".ProseMirror")
  await body.fill("Before the first illustration")
  await page.keyboard.press("Enter")
  const images: string[] = []
  for (const [index, alt] of [
    "First inline illustration",
    "Second inline illustration",
  ].entries()) {
    await page
      .getByRole("toolbar", { name: "Formatting", exact: true })
      .getByRole("button", { name: "Insert image", exact: true })
      .click()
    const dialog = page.getByRole("dialog", { name: "Insert image", exact: true })
    await dialog.locator('input[type="file"]').setInputFiles({
      name: `inline-${index}.png`,
      mimeType: "image/png",
      buffer: png,
    })
    await dialog.getByLabel("Image alt text", { exact: true }).fill(alt)
    const uploaded = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/upload" &&
        new URL(response.url()).searchParams.get("purpose") === "content"
    )
    await dialog.getByRole("button", { name: "Insert image", exact: true }).click()
    const response = await uploaded
    expect(response.status()).toBe(201)
    const { publicUrl } = await response.json()
    expect(new URL(publicUrl).pathname).toMatch(/^\/local-media\/content\/[0-9a-f-]+\.png$/)
    images.push(publicUrl)
    rememberUpload(publicUrl)
    await expectUploadState(publicUrl, "pending")
    await expect(dialog).not.toBeVisible()
    await expect(body.locator("img").nth(index)).toHaveAttribute("src", publicUrl)
    await page.keyboard.type(index === 0 ? "Between the illustrations" : "After the illustrations")
    if (index === 0) await page.keyboard.press("Enter")
  }
  const saved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/admin/posts" &&
      response.request().method() === "POST"
  )
  await page.getByRole("button", { name: "Save", exact: true }).click()
  const outcome = await (await saved).json()
  expect(outcome.ok).toBe(true)
  posts.push(outcome.postId)
  for (const image of images) await expectUploadState(image, "attached")
  await expect(page).toHaveURL(`${E2E_BASE_URL}/admin/posts/edit/${outcome.postId}`)
  await page.reload()
  await expect(body.locator("img")).toHaveCount(2)
  await expect(body.locator("img").first()).toHaveAttribute("alt", "First inline illustration")
  await expect(body.locator("img").nth(1)).toHaveAttribute("alt", "Second inline illustration")
  await expect(page.getByLabel("Cover image URL", { exact: true })).toHaveValue("")
  const preview = await author.request.post(
    `${E2E_BASE_URL}/api/admin/posts/${outcome.postId}/preview`,
    {
      data: {},
      headers: { Origin: E2E_BASE_URL },
    }
  )
  const { url } = await preview.json()
  const reader = await browser.newPage()
  await reader.setViewportSize({ width: 390, height: 844 })
  await reader.goto(url)
  for (const alt of ["First inline illustration", "Second inline illustration"]) {
    const image = reader.getByRole("img", { name: alt, exact: true })
    await expect(image).toBeVisible()
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(1)
    const box = await image.boundingBox()
    expect(box!.width).toBeLessThanOrEqual(390)
  }
  await reader.close()
  await body.locator("img").first().click()
  await page.getByRole("button", { name: "Edit image", exact: true }).click()
  await page
    .getByRole("dialog", { name: "Edit image", exact: true })
    .getByRole("button", { name: "Remove image", exact: true })
    .click()
  const updated = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/admin/posts" &&
      response.request().method() === "POST"
  )
  await page.getByRole("button", { name: "Save", exact: true }).click()
  expect((await (await updated).json()).ok).toBe(true)
  expect((await request.get(images[0])).status()).toBe(404)
  expect((await request.get(images[1])).status()).toBe(200)
  await expectUploadState(images[0], "deleted")
  await expectUploadState(images[1], "attached")
  covers.splice(covers.indexOf(images[0]), 1)
  const deleted = await author.request.delete(`${E2E_BASE_URL}/api/admin/posts/${outcome.postId}`, {
    data: {},
    headers: { Origin: E2E_BASE_URL },
  })
  expect((await deleted.json()).ok).toBe(true)
  expect((await request.get(images[1])).status()).toBe(404)
  await expectUploadState(images[1], "deleted")
  covers.splice(covers.indexOf(images[1]), 1)
  posts.splice(posts.indexOf(outcome.postId), 1)
  await page.close()
})

test("keeps an unsaved removed image pending and attaches it only after a successful save", async ({
  request,
}) => {
  test.setTimeout(90_000)
  const page = await author.newPage()
  await page.clock.setFixedTime(new Date())
  await page.goto(`${E2E_BASE_URL}/admin/posts/new`)
  await page
    .getByLabel("Title", { exact: true })
    .fill(`Pending inline image ${crypto.randomUUID()}`)
  const body = page.locator(".ProseMirror")
  await body.fill("An image can be removed and restored before saving this post.")
  await page.keyboard.press("Enter")
  await page
    .getByRole("toolbar", { name: "Formatting", exact: true })
    .getByRole("button", { name: "Insert image", exact: true })
    .click()
  const dialog = page.getByRole("dialog", { name: "Insert image", exact: true })
  await dialog.locator('input[type="file"]').setInputFiles({
    name: "pending-inline.png",
    mimeType: "image/png",
    buffer: png,
  })
  await dialog.getByLabel("Image alt text", { exact: true }).fill("Pending inline illustration")
  let uploads = 0
  page.on("request", (sent) => {
    if (new URL(sent.url()).pathname === "/api/upload") uploads++
  })
  const uploaded = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/upload" && response.status() === 201
  )
  await dialog.getByRole("button", { name: "Insert image", exact: true }).click()
  const { publicUrl } = await (await uploaded).json()
  rememberUpload(publicUrl)
  await expect(dialog).not.toBeVisible()
  await expectUploadState(publicUrl, "pending")

  await body.locator("img").click()
  await page.getByRole("button", { name: "Edit image", exact: true }).click()
  await page
    .getByRole("dialog", { name: "Edit image", exact: true })
    .getByRole("button", { name: "Remove image", exact: true })
    .click()
  await expect(body.locator("img")).toHaveCount(0)
  await expectUploadState(publicUrl, "pending")
  expect((await request.get(publicUrl)).status()).toBe(200)
  await page.getByRole("button", { name: "Undo", exact: true }).click()
  await expect(body.locator("img")).toHaveAttribute("src", publicUrl)

  let attempts = 0
  await page.route("**/api/admin/posts", async (route) => {
    if (route.request().method() !== "POST") return route.continue()
    attempts++
    if (attempts === 1)
      await route.fulfill({
        status: 400,
        json: { ok: false, message: "Post save temporarily unavailable" },
      })
    else await route.continue()
  })
  const save = page.getByRole("button", { name: "Save", exact: true })
  await save.click()
  await expect(page.getByRole("alert")).toContainText("Post save temporarily unavailable")
  await expect(body.locator("img")).toHaveAttribute("src", publicUrl)
  await expectUploadState(publicUrl, "pending")
  expect((await request.get(publicUrl)).status()).toBe(200)
  expect(uploads).toBe(1)

  const saved = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/admin/posts" && response.status() === 200
  )
  await save.click()
  const outcome = await (await saved).json()
  expect(outcome.ok).toBe(true)
  posts.push(outcome.postId)
  await expectUploadState(publicUrl, "attached")
  expect(uploads).toBe(1)
  expect(attempts).toBe(2)
  await page.close()
})

test("scheduled cleanup deletes expired pending uploads and preserves fresh uploads", async ({
  request,
}) => {
  test.setTimeout(60_000)
  const images: string[] = []
  for (let index = 0; index < 2; index++) {
    const uploaded = await author.request.post(`${E2E_BASE_URL}/api/upload?purpose=content`, {
      headers: { Origin: E2E_BASE_URL, "Content-Type": "image/png" },
      data: png,
    })
    expect(uploaded.status()).toBe(201)
    const { publicUrl } = await uploaded.json()
    rememberUpload(publicUrl)
    images.push(publicUrl)
    await expectUploadState(publicUrl, "pending")
    expect((await request.get(publicUrl)).status()).toBe(200)
  }
  const [expired, fresh] = images
  const sql = uploadDatabase()
  const key = localUploadKey(expired)
  await sql`UPDATE media_uploads SET created_at = now() - interval '25 hours'
    WHERE key = ${key} AND url = ${expired}`

  // Vite/Miniflare's built-in local trigger invokes the real exported scheduled
  // handler and its runtime bindings, without adding an application test endpoint.
  const triggered = await request.get("/cdn-cgi/local/scheduled", {
    params: { cron: "17 * * * *", format: "json" },
  })
  expect(triggered.status()).toBe(200)
  expect(await triggered.json()).toMatchObject({ outcome: "ok" })
  await expectUploadState(expired, "deleted")
  expect((await request.get(expired)).status()).toBe(404)
  await expectUploadState(fresh, "pending")
  expect((await request.get(fresh)).status()).toBe(200)
  covers.splice(covers.indexOf(expired), 1)
})
