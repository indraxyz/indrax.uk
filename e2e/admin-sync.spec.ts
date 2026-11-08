import { expect, test, type Page } from "@playwright/test"
import type { AdminPost } from "../features/writing/types"

// UI contract tests use mocked transport and never mutate shared database fixtures.
const ID = "550e8400-e29b-41d4-a716-446655440000"
const post: AdminPost = {
  id: ID,
  slug: "sync-post",
  title: "Sync post",
  excerpt: "Saved excerpt",
  coverUrl: null,
  coverAlt: null,
  publishedAt: null,
  updatedAt: "2026-01-01T00:00:00Z",
  tags: [],
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Saved body" }] }],
  },
  status: "draft",
  seriesTitle: null,
  seriesDescription: null,
  seriesOrder: null,
}

async function setup(page: Page) {
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: "browser-fixture",
      url: test.info().project.use.baseURL as string,
    },
  ])
  let stored = structuredClone(post)
  let failure = false
  const writes: Record<string, unknown>[] = []
  let reads = 0
  await page.route("**/api/admin/**", async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === "/api/admin/session")
      return route.fulfill({
        json: {
          author: { id: "author", name: "Author", email: "author@example.test" },
          authConfigured: true,
          coverUploadsConfigured: false,
          databaseConfigured: true,
          previewConfigured: true,
        },
      })
    if (path === `/api/admin/posts/${ID}`) {
      reads++
      return failure
        ? route.fulfill({ status: 503, json: { error: "Unavailable" } })
        : route.fulfill({ json: stored })
    }
    if (path === "/api/admin/posts" && route.request().method() === "POST") {
      const input = route.request().postDataJSON()
      writes.push(input)
      if (failure)
        return route.fulfill({
          status: 422,
          json: { ok: false, message: "Temporary save failure." },
        })
      stored = { ...stored, ...input, id: ID, content: input.content, tags: [] }
      return route.fulfill({ json: { ok: true, postId: ID } })
    }
    if (path === "/api/admin/tags") return route.fulfill({ json: [] })
    return route.fulfill({ json: {} })
  })
  return {
    writes,
    get reads() {
      return reads
    },
    update: (patch: Partial<AdminPost>) => {
      stored = { ...stored, ...patch }
    },
    fail: (value = true) => {
      failure = value
    },
  }
}

async function refresh(page: Page) {
  await page.getByRole("button", { name: "More post actions" }).click()
  await page.getByRole("menuitem", { name: "Refresh post" }).click()
}

test("refreshes only the filtered post results and retains rows on failure", async ({ page }) => {
  await setup(page)
  const queries: string[] = []
  let failure = false
  await page.route("**/api/admin/posts/archive?**", (route) => {
    queries.push(new URL(route.request().url()).search)
    return failure
      ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({ json: { posts: [post], total: 1, page: 1, pageCount: 1 } })
  })
  await page.goto("/admin/posts?q=Sync&status=draft&sort=title-asc")
  await expect(page.getByRole("link", { name: "Sync post", exact: true }).first()).toBeVisible()
  const url = page.url()
  const group = page.getByRole("group", { name: "Archive controls" })
  await group.getByRole("button", { name: "Refresh posts" }).click()
  await expect.poll(() => queries.length).toBe(2)
  expect(queries[1]).toBe(queries[0])
  expect(page.url()).toBe(url)
  failure = true
  await group.getByRole("button", { name: "Refresh posts" }).click()
  await expect(page.getByRole("alert")).toContainText("current results are still shown")
  await expect(page.getByRole("link", { name: "Sync post", exact: true }).first()).toBeVisible()
})

test("refreshes the editor document and metadata after confirming discard", async ({ page }) => {
  const state = await setup(page)
  await page.goto(`/admin/posts/edit/${ID}`)
  await expect(page.locator(".tiptap")).toContainText("Saved body")
  await page.getByLabel("Title", { exact: true }).fill("Unsaved title")
  state.update({
    title: "Fresh title",
    content: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Fresh body" }] }],
    },
  })
  await refresh(page)
  await page.getByRole("button", { name: "Cancel", exact: true }).click()
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Unsaved title")
  expect(state.reads).toBe(1)
  await refresh(page)
  await page.getByRole("button", { name: "Discard and refresh", exact: true }).click()
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Fresh title")
  await expect(page.locator(".tiptap")).toContainText("Fresh body")
  await expect(page.locator("[data-unsaved-changes]")).toHaveCount(0)
})

test("failed refresh preserves dirty fields and body", async ({ page }) => {
  const state = await setup(page)
  await page.goto(`/admin/posts/edit/${ID}`)
  await page.getByLabel("Title", { exact: true }).fill("Keep my title")
  state.fail()
  await refresh(page)
  await page.getByRole("button", { name: "Discard and refresh", exact: true }).click()
  await expect(page.getByRole("alert")).toContainText("could not be completed")
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Keep my title")
  await expect(page.locator(".tiptap")).toContainText("Saved body")
  await expect(page.locator("[data-unsaved-changes]")).toBeVisible()
})

test("locks editor input and autosave while a refresh is in flight", async ({ page }) => {
  const state = await setup(page)
  await page.clock.install()
  await page.goto(`/admin/posts/edit/${ID}`)
  await expect(page.locator(".tiptap")).toContainText("Saved body")
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(`**/api/admin/posts/${ID}`, async (route) => {
    await gate
    await route.fulfill({ json: { ...post, title: "Fresh after waiting" } })
  })
  await page.clock.fastForward(59_000)
  await refresh(page)
  const locked = page.locator("fieldset[inert]")
  await expect(locked).toBeVisible()
  await expect(page.getByLabel("Title", { exact: true })).toBeDisabled()
  await expect(locked.locator(".tiptap")).toContainText("Saved body")
  await page.keyboard.type("Must not reach the editor")
  await expect(page.locator(".tiptap")).toContainText("Saved body")
  await expect(page.locator(".tiptap")).not.toContainText("Must not reach")
  await page.clock.fastForward(1_000)
  expect(state.writes).toHaveLength(0)
  release()
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Fresh after waiting")
  await expect(page.locator("fieldset[inert]")).toHaveCount(0)
})

test("autosaves dirty draft edits each minute, skips clean and status changes", async ({
  page,
}) => {
  const state = await setup(page)
  await page.clock.install()
  await page.goto(`/admin/posts/edit/${ID}`)
  await expect(page.locator(".tiptap")).toBeVisible()
  await page.getByLabel("Excerpt", { exact: true }).fill("Autosaved excerpt")
  await page.clock.fastForward(59_000)
  expect(state.writes).toHaveLength(0)
  await page.clock.fastForward(1_000)
  await expect.poll(() => state.writes.length).toBe(1)
  expect(state.writes[0]).toMatchObject({
    id: ID,
    status: "draft",
    excerpt: "Autosaved excerpt",
  })
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible()
  await page.clock.fastForward(60_000)
  expect(state.writes).toHaveLength(1)
  await page.getByLabel("Status", { exact: true }).selectOption("published")
  await page.clock.fastForward(60_000)
  expect(state.writes).toHaveLength(1)
  await expect(page.getByRole("status").filter({ hasText: "Save manually" })).toBeVisible()
})

test("creates a valid changed draft once and reuses its ID on subsequent autosave", async ({
  page,
}) => {
  const state = await setup(page)
  await page.clock.install()
  await page.goto("/admin/posts/new")
  await expect(page.locator(".tiptap")).toBeVisible()
  await page.getByLabel("Title", { exact: true }).fill("New draft")
  await page.clock.fastForward(60_000)
  expect(state.writes).toHaveLength(0)
  await page.locator(".tiptap").fill("New body")
  await page.clock.fastForward(60_000)
  await expect.poll(() => state.writes.length).toBe(1)
  expect(state.writes[0]).toMatchObject({ status: "draft" })
  expect(state.writes[0].id).toBeUndefined()
  await expect(page).toHaveURL(new RegExp(`/admin/posts/edit/${ID}$`))
  await page.getByLabel("Excerpt", { exact: true }).fill("Second save")
  await page.clock.fastForward(60_000)
  await expect.poll(() => state.writes.length).toBe(2)
  expect(state.writes[1]).toMatchObject({ id: ID, status: "draft", excerpt: "Second save" })
})

test("failed autosave retains work and retries only on the next minute", async ({ page }) => {
  const state = await setup(page)
  await page.clock.install()
  await page.goto(`/admin/posts/edit/${ID}`)
  await expect(page.locator(".tiptap")).toBeVisible()
  await page.getByLabel("Excerpt", { exact: true }).fill("Keep this change")
  state.fail()
  await page.clock.fastForward(60_000)
  await expect(page.getByRole("alert")).toContainText("Temporary save failure")
  await expect(page.locator("[data-unsaved-changes]")).toBeVisible()
  state.fail(false)
  await page.clock.fastForward(60_000)
  await expect.poll(() => state.writes.length).toBe(2)
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible()
  await expect(page.getByLabel("Excerpt", { exact: true })).toHaveValue("Keep this change")
})

test("serializes manual and automatic saves while preserving in-flight edits", async ({ page }) => {
  await setup(page)
  await page.clock.install()
  const writes: Record<string, unknown>[] = []
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/admin/posts", async (route) => {
    writes.push(route.request().postDataJSON())
    if (writes.length === 1) await gate
    await route.fulfill({ json: { ok: true, postId: ID } })
  })
  await page.goto(`/admin/posts/edit/${ID}`)
  await expect(page.locator(".tiptap")).toBeVisible()
  await page.getByLabel("Excerpt", { exact: true }).fill("First snapshot")
  await page.clock.fastForward(59_000)
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect.poll(() => writes.length).toBe(1)
  await page.getByLabel("Excerpt", { exact: true }).fill("Later typing")
  await page.clock.fastForward(1_000)
  expect(writes).toHaveLength(1)
  release()
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeEnabled()
  await expect(page.locator("[data-unsaved-changes]")).toBeVisible()
  await expect(page.getByLabel("Excerpt", { exact: true })).toHaveValue("Later typing")
  await page.clock.fastForward(60_000)
  await expect.poll(() => writes.length).toBe(2)
  expect(writes[0].excerpt).toBe("First snapshot")
  expect(writes[1].excerpt).toBe("Later typing")
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible()
})

for (const status of ["published", "archived"] as const) {
  test(`${status} edits require manual save`, async ({ page }) => {
    const state = await setup(page)
    state.update({ status })
    await page.clock.install()
    await page.goto(`/admin/posts/edit/${ID}`)
    await expect(page.locator(".tiptap")).toBeVisible()
    await page.getByLabel("Excerpt", { exact: true }).fill("Manual edit")
    await page.clock.fastForward(120_000)
    expect(state.writes).toHaveLength(0)
    await expect(
      page.getByText("Autosave is for drafts only. Save changes manually.")
    ).toBeVisible()
    await page.getByRole("button", { name: "Save", exact: true }).click()
    await expect.poll(() => state.writes.length).toBe(1)
    expect(state.writes[0]).toMatchObject({ id: ID, status, excerpt: "Manual edit" })
  })
}

test("retains the editor when the post recheck after autosave fails", async ({ page }) => {
  await setup(page)
  await page.clock.install()
  await page.goto(`/admin/posts/edit/${ID}`)
  await expect(page.locator(".tiptap")).toBeVisible()
  await page.route(`**/api/admin/posts/${ID}`, (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } })
  )
  await page.getByLabel("Excerpt", { exact: true }).fill("Keep the editor open")
  await page.clock.fastForward(60_000)
  await expect(page.getByRole("alert")).toContainText("editor changes are still here")
  await expect(page.getByLabel("Excerpt", { exact: true })).toHaveValue("Keep the editor open")
  await expect(page.locator(".tiptap")).toContainText("Saved body")
})
