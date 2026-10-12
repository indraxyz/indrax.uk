import { expect, test, type Page } from "@playwright/test"

const id = "550e8400-e29b-41d4-a716-446655440000"
async function editorFixture(page: Page) {
  let post = {
    id,
    slug: "actions-fixture",
    title: "Actions fixture",
    status: "draft",
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
  await page.goto(`/admin/edit/${id}`)
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(post.title)
  await expect(page.locator(".tiptap")).toBeVisible()
  return { writes }
}
async function more(page: Page) {
  await page.getByRole("button", { name: "More post actions", exact: true }).click()
}

test("keeps Copy link loading on its own icon, reports clipboard failure and shows no preview URL", async ({
  page,
}) => {
  await editorFixture(page)
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Denied")
        },
      },
    })
  )
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/preview", async (route) => {
    await held
    await route.fulfill({ json: { ok: true, url: "/writing/actions-fixture/preview?token=test" } })
  })
  await more(page)
  await page.getByRole("menuitem", { name: "Copy link", exact: true }).click()
  try {
    await expect(
      page.getByRole("menuitem", { name: "Copying…", exact: true }).locator("svg")
    ).toHaveClass(/animate-spin/)
    await expect(
      page.getByRole("menuitem", { name: "Publish", exact: true }).locator("svg")
    ).not.toHaveClass(/animate-spin/)
  } finally {
    release()
  }
  await expect(page.getByRole("alert")).toContainText("Allow clipboard access")
  await expect(page.getByLabel("Preview link", { exact: true })).toHaveCount(0)
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => {} },
    })
  )
  await page.getByRole("menuitem", { name: "Copy link", exact: true }).click()
  await expect(page.getByRole("menuitem", { name: "Copied", exact: true })).toBeVisible()
  await expect(page.getByRole("alert")).toHaveCount(0)
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

test("confirms publication when saving form status and disables stale secondary actions", async ({
  page,
}) => {
  const { writes } = await editorFixture(page)
  await page.getByLabel("Status", { exact: true }).selectOption("published")
  await more(page)
  await expect(page.getByRole("menuitem", { name: "Publish", exact: true })).toBeDisabled()
  await expect(page.getByRole("menuitem", { name: "Copy link", exact: true })).toBeDisabled()
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
  expect(await toolbar.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true)
  const tops = await toolbar
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().top))
  expect(new Set(tops).size).toBe(1)
  await toolbar.getByRole("button", { name: "Redo", exact: true }).scrollIntoViewIfNeeded()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  const actions = page.getByRole("group", { name: "Post actions", exact: true })
  await expect(actions.getByRole("button").first()).toHaveText("Saved")
  await actions.screenshot({ path: "test-results/post-actions-mobile.png" })
})
