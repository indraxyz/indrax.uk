import { expect, test, type Page } from "@playwright/test"

type Status = "draft" | "published" | "archived"
const ids = {
  draft: "550e8400-e29b-41d4-a716-446655440001",
  published: "550e8400-e29b-41d4-a716-446655440002",
  archived: "550e8400-e29b-41d4-a716-446655440003",
}

/** All private reads and writes are fixtures; these tests never modify real posts. */
async function archiveFixture(page: Page, query = "") {
  let posts = (["draft", "published", "archived"] as const).map((status) => ({
    id: ids[status],
    slug: `${status}-fixture`,
    title: `${status} fixture`,
    status: status as Status,
    excerpt: "An independent post with list actions.",
    coverUrl: process.env.MEDIA_ORIGIN ? `${process.env.MEDIA_ORIGIN}/covers/fixture.png` : null,
    coverAlt: "Fixture cover",
    tags: [],
    publishedAt: null,
    updatedAt: "2026-10-10T00:00:00Z",
    readingTime: 2,
    viewCount: 0,
  }))
  if (process.env.MEDIA_ORIGIN)
    await page.route(`${process.env.MEDIA_ORIGIN}/covers/fixture.png`, (route) =>
      route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5XsAAAAASUVORK5CYII=",
          "base64"
        ),
      })
    )
  const writes: { method: string; path: string; data?: Record<string, unknown> }[] = []
  const archiveQueries: string[] = []
  const fullPostReads: string[] = []
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
  await page.route("**/api/admin/posts**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.endsWith("/archive")) {
      archiveQueries.push(url.search)
      const status = url.searchParams.get("status")
      const matching = posts.filter((post) => !status || status === "any" || post.status === status)
      return route.fulfill({
        json: {
          posts: matching,
          total: matching.length + 20,
          page: Number(url.searchParams.get("page") ?? 1),
          pageCount: 3,
        },
      })
    }
    if (request.method() === "GET") {
      fullPostReads.push(url.pathname)
      return route.fulfill({ status: 500, json: { message: "Full post reads are unnecessary." } })
    }
    const postId = url.pathname.split("/")[4]
    const data = request.postData()
      ? (request.postDataJSON() as Record<string, unknown>)
      : undefined
    writes.push({ method: request.method(), path: url.pathname, data })
    if (url.pathname.endsWith("/preview"))
      return route.fulfill({
        json: {
          ok: true,
          url: `/writing/${posts.find((post) => post.id === postId)!.slug}/preview?token=test`,
        },
      })
    if (request.method() === "DELETE") posts = posts.filter((post) => post.id !== postId)
    else if (url.pathname.endsWith("/status"))
      posts = posts.map((post) =>
        post.id === postId ? { ...post, status: data!.status as Status } : post
      )
    return route.fulfill({ json: { ok: true, postId } })
  })
  await page
    .context()
    .route(/\/writing\/(draft|published|archived)-fixture(?:\/preview\?.*)?$/, (route) =>
      route.fulfill({ contentType: "text/html", body: "<h1>Post destination</h1>" })
    )
  await page.goto(`/admin/posts${query}`)
  await expect(page.getByRole("heading", { level: 1, name: "Posts", exact: true })).toBeVisible()
  return { writes, archiveQueries, fullPostReads }
}

function actions(page: Page, status: Status) {
  return page.getByRole("button", { name: `Actions for ${status} fixture`, exact: true })
}

for (const status of ["draft", "published", "archived"] as const) {
  test(`orders ${status} actions and opens the correct destination in a new tab`, async ({
    page,
  }) => {
    const { writes, fullPostReads } = await archiveFixture(page)
    await expect(
      page.getByRole("link", { name: `Edit ${status} fixture`, exact: true })
    ).toHaveAttribute("href", `/admin/posts/edit/${ids[status]}`)
    await actions(page, status).click()
    const published = status === "published"
    await expect(page.getByRole("menuitem")).toHaveText([
      published ? "Visit" : "Preview",
      published ? "Unpublish" : "Publish",
      ...(status === "archived" ? [] : ["Archive"]),
      "Delete",
    ])
    await expect(page.getByRole("menu").getByRole("separator")).toHaveCount(1)
    const icons = await page
      .getByRole("menuitem")
      .locator("svg")
      .evaluateAll((elements) => elements.map((element) => element.innerHTML))
    expect(new Set(icons).size).toBe(icons.length)

    const opened = page.waitForEvent("popup")
    await page.getByRole("menuitem", { name: published ? "Visit" : "Preview", exact: true }).click()
    const tab = await opened
    await expect(tab).toHaveURL(
      new RegExp(`/writing/${status}-fixture${published ? "$" : "/preview\\?token=test$"}`)
    )
    await expect(tab.getByRole("heading")).toHaveText("Post destination")
    expect(await tab.evaluate(() => window.opener)).toBeNull()
    await expect(page).toHaveURL(/\/admin\/posts$/)
    expect(writes.filter((write) => write.path.endsWith("/preview"))).toHaveLength(
      published ? 0 : 1
    )
    expect(fullPostReads).toEqual([])
    await tab.close()
  })
}

test("cancels a mutation without writing and restores focus to its row", async ({ page }) => {
  const { writes } = await archiveFixture(page)
  for (const action of ["Publish", "Archive", "Delete"]) {
    await actions(page, "draft").click()
    await page.getByRole("menuitem", { name: action, exact: true }).click()
    const dialog = page.getByRole("alertdialog", { name: `${action} post?`, exact: true })
    await expect(dialog).toContainText("draft fixture")
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(actions(page, "draft")).toBeFocused()
    expect(writes).toEqual([])
  }
})

test("publishes and unpublishes the selected row and refreshes available actions", async ({
  page,
}) => {
  const { writes, fullPostReads } = await archiveFixture(page)
  for (const [action, target] of [
    ["Publish", "published"],
    ["Unpublish", "draft"],
  ]) {
    await actions(page, "draft").click()
    await page.getByRole("menuitem", { name: action, exact: true }).click()
    const dialog = page.getByRole("alertdialog", { name: `${action} post?`, exact: true })
    await dialog.getByRole("button", { name: `${action} post`, exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(writes.at(-1)).toMatchObject({
      path: `/api/admin/posts/${ids.draft}/status`,
      data: { status: target },
    })
    await actions(page, "draft").click()
    await expect(page.getByRole("menuitem").first()).toHaveText(
      target === "published" ? "Visit" : "Preview"
    )
    await page.keyboard.press("Escape")
  }
  expect(fullPostReads).toEqual([])
  await expect(page.getByRole("link", { name: "published fixture", exact: true })).toBeVisible()
})

test("archives a filtered draft and preserves the current query when refreshing", async ({
  page,
}) => {
  const query = "?q=fixture&status=draft&tag=private&sort=oldest&page=2"
  const { writes, archiveQueries } = await archiveFixture(page, query)
  const originalUrl = page.url()
  await actions(page, "draft").click()
  await page.getByRole("menuitem", { name: "Archive", exact: true }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Archive post", exact: true })
    .click()
  await expect(actions(page, "draft")).toHaveCount(0)
  expect(writes.at(-1)?.data).toEqual({ status: "archived" })
  expect(page.url()).toBe(originalUrl)
  expect(archiveQueries.length).toBeGreaterThan(1)
  expect(archiveQueries.at(-1)).toBe(archiveQueries[0])
})

test("keeps publishing errors open for retry without changing another post", async ({ page }) => {
  const { writes } = await archiveFixture(page)
  let attempts = 0
  await page.route("**/status", async (route) => {
    if (++attempts === 1)
      return route.fulfill({
        status: 503,
        json: { ok: false, message: "Temporary publishing failure." },
      })
    await route.fallback()
  })
  await actions(page, "draft").click()
  await page.getByRole("menuitem", { name: "Publish", exact: true }).click()
  const dialog = page.getByRole("alertdialog", { name: "Publish post?", exact: true })
  await dialog.getByRole("button", { name: "Publish post", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText("The request could not be completed")
  expect(writes).toEqual([])
  await dialog.getByRole("button", { name: "Publish post", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(writes).toHaveLength(1)
  await actions(page, "published").click()
  await expect(page.getByRole("menuitem").first()).toHaveText("Visit")
})

test("retries failed deletion, removes only its row, and retains list filters and page", async ({
  page,
}) => {
  const { writes, archiveQueries } = await archiveFixture(
    page,
    "?q=fixture&tag=private&sort=oldest&page=2"
  )
  const originalUrl = page.url()
  let attempts = 0
  await page.route(`**/api/admin/posts/${ids.draft}`, async (route) => {
    if (route.request().method() === "DELETE" && ++attempts === 1)
      return route.fulfill({ json: { ok: false, message: "Temporary deletion failure." } })
    await route.fallback()
  })
  await actions(page, "draft").click()
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click()
  const dialog = page.getByRole("alertdialog", { name: "Delete post?", exact: true })
  await dialog.getByRole("button", { name: "Delete post", exact: true }).click()
  await expect(dialog.getByRole("alert")).toContainText("Temporary deletion failure")
  await dialog.getByRole("button", { name: "Delete post", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(actions(page, "draft")).toHaveCount(0)
  await expect(actions(page, "published")).toBeVisible()
  await expect(actions(page, "archived")).toBeVisible()
  expect(writes).toHaveLength(1)
  expect(writes[0]).toMatchObject({ method: "DELETE", path: `/api/admin/posts/${ids.draft}` })
  expect(page.url()).toBe(originalUrl)
  expect(archiveQueries.at(-1)).toBe(archiveQueries[0])
})

for (const width of [320, 1280]) {
  test(`supports keyboard actions without overflowing at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await archiveFixture(page)
    const trigger = actions(page, "draft")
    await trigger.focus()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("menuitem", { name: "Preview", exact: true })).toBeFocused()
    await page.keyboard.press("ArrowDown")
    await expect(page.getByRole("menuitem", { name: "Publish", exact: true })).toBeFocused()
    await page.keyboard.press("ArrowDown")
    await page.keyboard.press("Enter")
    const dialog = page.getByRole("alertdialog", { name: "Archive post?", exact: true })
    await expect(dialog).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    )
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(trigger).toBeFocused()
    await page.keyboard.press("Enter")
    const menu = page.getByRole("menu")
    await expect(menu).toBeVisible()
    const bounds = await menu.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
    await page.screenshot({
      path: test.info().outputPath(`post-list-actions-${width}.png`),
      fullPage: true,
    })
    await page.keyboard.press("Escape")
    await expect(trigger).toBeFocused()
  })
}

for (const width of [320, 1280]) {
  test(`groups public destinations and supports keyboard navigation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await archiveFixture(page)
    if (width < 768) await page.getByRole("button", { name: "Open admin menu" }).click()
    const navigation = page
      .getByRole("navigation", { name: "Admin", exact: true })
      .filter({ visible: true })
    await expect(navigation.getByRole("link")).toHaveCount(1)
    await expect(navigation.getByRole("link", { name: "Posts", exact: true })).toHaveAttribute(
      "aria-current",
      "page"
    )
    const trigger = navigation.getByRole("button", { name: "Public", exact: true })
    await trigger.focus()
    await page.keyboard.press("Enter")
    const menu = page.getByRole("menu", { name: "Public", exact: true })
    await expect(menu.getByRole("menuitem")).toHaveText(["Resume", "Writing", "Stack"])
    for (const [name, href] of [
      ["Resume", "/resume"],
      ["Writing", "/writing"],
      ["Stack", "/tech-stack"],
    ])
      await expect(menu.getByRole("menuitem", { name, exact: true })).toHaveAttribute("href", href)
    await expect(menu.getByRole("menuitem", { name: "Resume", exact: true })).toBeFocused()
    await page.screenshot({
      path: test.info().outputPath(`public-menu-${width}.png`),
      fullPage: false,
    })
    await page.keyboard.press("Escape")
    await expect(trigger).toBeFocused()
    await trigger.click()
    await menu.getByRole("menuitem", { name: "Stack", exact: true }).click()
    await expect(page).toHaveURL(/\/tech-stack$/)
    await expect(page.getByRole("heading", { level: 1, name: "Tech Stack" })).toBeVisible()
  })
}

test("opens the editor from a post cover", async ({ page }) => {
  test.skip(!process.env.MEDIA_ORIGIN, "Cover validation needs the configured public media origin")
  await archiveFixture(page)
  await page.getByRole("link", { name: "Edit cover for draft fixture", exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/posts/edit/${ids.draft}$`))
})
