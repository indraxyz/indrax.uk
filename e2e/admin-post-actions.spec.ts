import { expect, test, type Page } from "@playwright/test"

const id = "550e8400-e29b-41d4-a716-446655440000"
async function editorFixture(page: Page, status = "draft") {
  let post = {
    id,
    slug: "actions-fixture",
    title: "Actions fixture",
    status,
    excerpt: null,
    coverUrl: null,
    coverAlt: null,
    tags: [],
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Article body" }] }],
    },
    seriesTitle: null,
    seriesDescription: null,
    seriesOrder: null,
    publishedAt: null,
    updatedAt: "2026-10-10T00:00:00Z",
  }
  const writes: { method: string; path: string; data: Record<string, unknown> }[] = []
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
        coverUploadsConfigured: true,
        previewConfigured: true,
      },
    })
  )
  await page.route("**/api/admin/tags", (route) => route.fulfill({ json: [] }))
  await page.route("**/api/admin/overview", (route) =>
    route.fulfill({ json: { total: 1, published: 0, drafts: 1, archived: 0, latestDraft: null } })
  )
  await page.route("**/api/admin/posts/archive*", (route) =>
    route.fulfill({ json: { posts: [], total: 0, page: 1, pageCount: 1 } })
  )
  await page.route("**/api/admin/posts**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (request.method() === "GET") return route.fulfill({ json: post })
    const data = request.postDataJSON() as Record<string, unknown>
    writes.push({ method: request.method(), path, data })
    if (path.endsWith("/status")) post = { ...post, status: data.status as string }
    else if (request.method() === "POST") post = { ...post, ...data } as typeof post
    await route.fulfill({ json: { ok: true, postId: id } })
  })
  await page.goto(`/admin/posts/edit/${id}`)
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(post.title)
  await expect(page.locator(".tiptap")).toBeVisible()
  return { writes }
}
async function more(page: Page) {
  await page.getByRole("button", { name: "More post actions", exact: true }).click()
}

for (const status of ["draft", "archived", "published"]) {
  test(`opens ${status === "published" ? "Visit" : "Preview"} in a separate tab for ${status} posts`, async ({
    page,
  }) => {
    await editorFixture(page, status)
    const previewCalls: string[] = []
    await page.route("**/preview", (route) => {
      previewCalls.push(route.request().url())
      return route.fulfill({
        json: { ok: true, url: "/writing/actions-fixture/preview?token=test" },
      })
    })
    await page
      .context()
      .route(/\/writing\/actions-fixture(?:\/preview\?.*)?$/, (route) =>
        route.fulfill({ contentType: "text/html", body: "<h1>Post destination</h1>" })
      )
    await more(page)
    await expect(page.getByRole("menuitem")).toHaveText([
      status === "published" ? "Visit" : "Preview",
      status === "published" ? "Unpublish" : "Publish",
      ...(status === "archived" ? [] : ["Archive"]),
      "Delete",
    ])
    await expect(page.getByRole("menu").getByRole("separator")).toHaveCount(1)
    await expect(page.getByRole("menuitem", { name: "Copy link", exact: true })).toHaveCount(0)
    const opened = page.waitForEvent("popup")
    await page
      .getByRole("menuitem", { name: status === "published" ? "Visit" : "Preview", exact: true })
      .click()
    const tab = await opened
    await expect(tab).toHaveURL(
      status === "published"
        ? /\/writing\/actions-fixture$/
        : /\/writing\/actions-fixture\/preview\?token=test$/
    )
    await expect(tab.getByRole("heading")).toHaveText("Post destination")
    expect(await tab.evaluate(() => window.opener)).toBeNull()
    await expect(page).toHaveURL(new RegExp(`/admin/posts/edit/${id}$`))
    expect(previewCalls).toHaveLength(status === "published" ? 0 : 1)
    await tab.close()
  })
}

test("new posts enable their action menu after their first successful save", async ({ page }) => {
  await editorFixture(page)
  await page.goto("/admin/posts/new")
  await more(page)
  await expect(page.getByRole("menuitem")).toHaveText(["Preview", "Publish", "Archive", "Delete"])
  for (const item of await page.getByRole("menuitem").all()) await expect(item).toBeDisabled()
  await expect(page.getByRole("menu")).toContainText("Save the post to enable these actions.")
  await page.keyboard.press("Escape")
  await page.getByLabel("Title", { exact: true }).fill("New actions fixture")
  await page.locator(".tiptap").fill("A new draft body")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/posts/edit/${id}$`))
  await more(page)
  await expect(page.getByRole("menuitem", { name: "Preview", exact: true })).toBeEnabled()
})

test("shows preview loading, closes a failed tab and allows retry", async ({ page }) => {
  await editorFixture(page)
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let attempts = 0
  await page.route("**/preview", async (route) => {
    attempts++
    if (attempts === 1) {
      await held
      await route.fulfill({ json: { ok: false, message: "Temporary preview failure." } })
    } else {
      await route.fulfill({
        json: { ok: true, url: "/writing/actions-fixture/preview?token=retry" },
      })
    }
  })
  await page
    .context()
    .route("**/writing/actions-fixture/preview?token=retry", (route) =>
      route.fulfill({ contentType: "text/html", body: "<h1>Preview retry</h1>" })
    )
  await more(page)
  const opened = page.waitForEvent("popup")
  await page.getByRole("menuitem", { name: "Preview", exact: true }).click()
  const tab = await opened
  try {
    await expect(
      page.getByRole("menuitem", { name: "Opening…", exact: true }).locator("svg")
    ).toHaveClass(/animate-spin/)
    await expect(
      page.getByRole("menuitem", { name: "Publish", exact: true }).locator("svg")
    ).not.toHaveClass(/animate-spin/)
  } finally {
    release()
  }
  await expect.poll(() => tab.isClosed()).toBe(true)
  await expect(page.getByRole("alert")).toContainText("Temporary preview failure")
  const retry = page.waitForEvent("popup")
  await page.getByRole("menuitem", { name: "Preview", exact: true }).click()
  const retriedTab = await retry
  await expect(retriedTab).toHaveURL(/token=retry$/)
  await expect(page.getByRole("alert")).toHaveCount(0)
  await retriedTab.close()
})

test("reports a blocked popup before requesting a preview", async ({ page }) => {
  const { writes } = await editorFixture(page)
  await page.evaluate(() => {
    window.open = () => null
  })
  await more(page)
  await page.getByRole("menuitem", { name: "Preview", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("Allow pop-ups for this site")
  expect(writes).toHaveLength(0)
})

test("confirms publish/unpublish and keeps a failed request open for retry", async ({ page }) => {
  const { writes } = await editorFixture(page)
  await more(page)
  await page.getByRole("menuitem", { name: "Publish", exact: true }).click()
  const publish = page.getByRole("alertdialog", { name: "Publish post?", exact: true })
  await expect(publish).toBeVisible()
  expect(writes).toHaveLength(0)
  await publish.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(page.getByRole("button", { name: "More post actions", exact: true })).toBeFocused()
  let attempts = 0
  await page.route("**/status", async (route) => {
    attempts++
    if (attempts === 1)
      await route.fulfill({ json: { ok: false, message: "Temporary publishing failure." } })
    else await route.fallback()
  })
  await more(page)
  await page.getByRole("menuitem", { name: "Publish", exact: true }).click()
  await publish.getByRole("button", { name: "Publish post", exact: true }).click()
  await expect(publish.getByRole("alert")).toContainText("Temporary publishing failure")
  await publish.getByRole("button", { name: "Publish post", exact: true }).click()
  await expect(publish).toHaveCount(0)
  expect(writes.at(-1)?.data.status).toBe("published")
  await more(page)
  await page.getByRole("menuitem", { name: "Unpublish", exact: true }).click()
  const unpublish = page.getByRole("alertdialog", { name: "Unpublish post?", exact: true })
  await unpublish.getByRole("button", { name: "Unpublish post", exact: true }).click()
  await expect(unpublish).toHaveCount(0)
  expect(writes.at(-1)?.data.status).toBe("draft")
})

test("archives a saved post with confirmation and retry, then offers Publish again", async ({
  page,
}) => {
  const { writes } = await editorFixture(page)
  let attempts = 0
  await page.route("**/status", async (route) => {
    if (++attempts === 1)
      await route.fulfill({ json: { ok: false, message: "Temporary archive failure." } })
    else await route.fallback()
  })
  await more(page)
  await page.getByRole("menuitem", { name: "Archive", exact: true }).click()
  const dialog = page.getByRole("alertdialog", { name: "Archive post?", exact: true })
  await expect(dialog).toContainText("You can publish it again later.")
  expect(writes).toHaveLength(0)
  await dialog.getByRole("button", { name: "Archive post", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText("Temporary archive failure.")
  await dialog.getByRole("button", { name: "Archive post", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes.at(-1)?.data.status).toBe("archived")
  await more(page)
  await expect(page.getByRole("menuitem")).toHaveText(["Preview", "Publish", "Delete"])
  await page.getByRole("menuitem", { name: "Publish", exact: true }).click()
  const publish = page.getByRole("alertdialog", { name: "Publish post?", exact: true })
  await publish.getByRole("button", { name: "Publish post", exact: true }).click()
  await expect(publish).toHaveCount(0)
  expect(writes.at(-1)?.data.status).toBe("published")
})

test("confirms publication when saving form status and disables stale secondary actions", async ({
  page,
}) => {
  const { writes } = await editorFixture(page)
  await page.getByLabel("Status", { exact: true }).selectOption("published")
  await more(page)
  await expect(page.getByRole("menuitem", { name: "Publish", exact: true })).toBeDisabled()
  await expect(page.getByRole("menuitem", { name: "Preview", exact: true })).toBeDisabled()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  const dialog = page.getByRole("alertdialog", { name: "Publish post?", exact: true })
  await expect(dialog).toBeVisible()
  expect(writes).toHaveLength(0)
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
  expect(writes).toHaveLength(0)
  await expect(page.getByLabel("Status", { exact: true })).toHaveValue("published")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await dialog.getByRole("button", { name: "Publish post", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes.at(-1)?.data.status).toBe("published")
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeDisabled()
  await page.getByLabel("Status", { exact: true }).selectOption("draft")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  const unpublish = page.getByRole("alertdialog", { name: "Unpublish post?", exact: true })
  await unpublish.getByRole("button", { name: "Unpublish post", exact: true }).click()
  await expect(unpublish).toHaveCount(0)
  expect(writes.at(-1)?.data.status).toBe("draft")
})

test("keeps the main toolbar in one scrollable row on mobile and Save first in the action group", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await editorFixture(page)
  const toolbar = page.getByRole("toolbar", { name: "Formatting", exact: true })
  await expect(toolbar.getByRole("button").nth(0)).toHaveAttribute("aria-label", "Undo")
  await expect(toolbar.getByRole("button").nth(1)).toHaveAttribute("aria-label", "Redo")
  await expect(toolbar.getByRole("button", { name: "Undo", exact: true })).toBeInViewport()
  await expect(toolbar.getByRole("button", { name: "Redo", exact: true })).toBeInViewport()
  expect(await toolbar.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true)
  const tops = await toolbar
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().top))
  expect(new Set(tops).size).toBe(1)
  await toolbar
    .getByRole("button", { name: "Clear formatting", exact: true })
    .scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  const actions = page.getByRole("group", { name: "Post actions", exact: true })
  await expect(actions.getByRole("button").first()).toHaveText("Saved")
  await actions.screenshot({ path: "test-results/post-actions-mobile.png" })
})

for (const width of [320, 1280]) {
  test(`groups the cover preview, URL and alt text on new/edit forms at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    page.on("dialog", (dialog) => void dialog.accept())
    const { writes } = await editorFixture(page)
    const imageUrl = "https://media.indrax.uk/covers/550e8400-e29b-41d4-a716-446655440000.png"
    await page.route(imageUrl, (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5XsAAAAASUVORK5CYII=",
          "base64"
        ),
      })
    )
    for (const path of [`/admin/posts/edit/${id}`, "/admin/posts/new"]) {
      await page.goto(path)
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      const cover = page.getByRole("group", { name: "Cover image", exact: true })
      await expect(cover).toHaveAttribute("data-slot", "field-set")
      const fields = cover.locator('[data-slot="field-group"]')
      await fields.getByLabel("Cover image URL", { exact: true }).fill(imageUrl)
      await fields.getByLabel("Cover alt text", { exact: true }).fill("Cover field group preview")
      const preview = fields.getByRole("img", { name: "Cover field group preview", exact: true })
      await expect(preview).toBeVisible()
      await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1)
      await expect(fields.locator('[data-slot="field"]')).toHaveCount(3)
      await expect(cover).toContainText("Cover changes take effect when you save the post.")
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      )
      expect(writes).toHaveLength(0)
    }
    await page.screenshot({ path: `test-results/cover-field-group-${width}.png`, fullPage: true })
  })
}

test("redirects bookmarked editor URLs to the posts area", async ({ page }) => {
  await editorFixture(page)
  await page.goto(`/admin/edit/${id}`)
  await expect(page).toHaveURL(new RegExp(`/admin/posts/edit/${id}$`))
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Actions fixture")
  await page.goto("/admin/new")
  await expect(page).toHaveURL(/\/admin\/posts\/new$/)
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("")
})
