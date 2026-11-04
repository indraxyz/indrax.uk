import { expect, test, type Page } from "@playwright/test"

import { ADMIN_POSTS_VIEW_STORAGE_KEY } from "@/features/writing/utils/admin-posts-view"

function deferred() {
  let release = () => {}
  const wait = new Promise<void>((resolve) => {
    release = resolve
  })
  return { wait, release }
}

const post = {
  id: "loading-fixture",
  slug: "loading-fixture",
  title: "Loaded writing fixture",
  excerpt: "Content replaces the loading placeholders.",
  coverUrl: null,
  coverAlt: null,
  publishedAt: "2026-10-09T00:00:00Z",
  updatedAt: "2026-10-09T00:00:00Z",
  readingTime: 3,
  tags: [],
}

async function adminSession(page: Page) {
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
        author: { id: "fixture-author", name: "Indra", email: "author@example.test" },
        authConfigured: true,
        databaseConfigured: true,
        coverUploadsConfigured: false,
        previewConfigured: true,
      },
    })
  )
  await page.route("**/api/admin/tags", (route) => route.fulfill({ json: [] }))
}

async function expectLoading(page: Page, label: string) {
  const skeleton = page.locator("[data-loading-skeleton]")
  await expect(skeleton).toHaveCount(1)
  await expect(skeleton.getByRole("status")).toHaveText(label)
  await expect(skeleton.locator('[aria-busy="true"]')).toHaveCount(1)
  await expect(skeleton.locator('[aria-hidden="true"]').first()).toBeAttached()
  await expect(skeleton.getByRole("button")).toHaveCount(0)
  await expect(skeleton.getByRole("link")).toHaveCount(0)
  await expect(page.getByRole("status", { name: "Loading page", exact: true })).toHaveCount(0)
  // A page-wide loader must not cover or intercept the navigation while cards load.
  await page.locator("header").getByRole("link").first().click({ trial: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width
  )
  return skeleton
}

test("home writing reserves card space while pending, then reuses cached cards on return", async ({
  page,
}) => {
  const response = deferred()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route("**/api/writing/recent**", async (route) => {
    await response.wait
    await route.fulfill({ json: [post] })
  })
  try {
    await page.goto("/")
    await expectLoading(page, "Loading recent writing…")
    response.release()
    await expect(page.getByRole("link", { name: post.title, exact: true })).toBeVisible()
    await expect(page.locator("[data-loading-skeleton]")).toHaveCount(0)
    const navigation = page.getByRole("navigation", { name: "Site", exact: true })
    await navigation.getByRole("link", { name: "Resume", exact: true }).click()
    await expect(page).toHaveURL(/\/resume$/)
    await navigation.getByRole("link", { name: "Home", exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole("link", { name: post.title, exact: true })).toBeVisible()
    await expect(page.locator("[data-loading-skeleton]")).toHaveCount(0)
  } finally {
    response.release()
  }
})

test("home removes placeholders and the writing section after an empty response", async ({
  page,
}) => {
  const response = deferred()
  await page.route("**/api/writing/recent**", async (route) => {
    await response.wait
    await route.fulfill({ json: [] })
  })
  try {
    await page.goto("/")
    await expectLoading(page, "Loading recent writing…")
    response.release()
    await expect(page.locator("[data-loading-skeleton]")).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "Writing", exact: true })).toHaveCount(0)
  } finally {
    response.release()
  }
})

test("writing skeletons honor reduced motion and resolve to cards", async ({ page }) => {
  const response = deferred()
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.route("**/api/writing/tags", (route) => route.fulfill({ json: [] }))
  await page.route("**/api/writing/posts*", async (route) => {
    await response.wait
    await route.fulfill({ json: { posts: [post], total: 1, page: 1, pageCount: 1 } })
  })
  try {
    await page.goto("/writing")
    const skeleton = await expectLoading(page, "Loading articles…")
    await expect(skeleton.locator("[data-skeleton]").first()).toHaveCSS("animation-name", "none")
    response.release()
    await expect(page.getByRole("link", { name: post.title, exact: true })).toBeVisible()
    await expect(page.locator("[data-loading-skeleton]")).toHaveCount(0)
    await expect(page.getByRole("status").filter({ hasText: "1 article" })).toBeVisible()
  } finally {
    response.release()
  }
})

test("writing replaces pending geometry with a retryable error and then its empty state", async ({
  page,
}) => {
  const response = deferred()
  let attempts = 0
  await page.route("**/api/writing/tags", (route) => route.fulfill({ json: [] }))
  await page.route("**/api/writing/posts*", async (route) => {
    await response.wait
    attempts += 1
    await route.fulfill(
      attempts === 1
        ? { status: 500, json: { error: "Fixture failure" } }
        : { json: { posts: [], total: 0, page: 1, pageCount: 0 } }
    )
  })
  try {
    await page.goto("/writing")
    await expectLoading(page, "Loading articles…")
    response.release()
    await expect(page.getByRole("alert")).toContainText("Unable to load writing")
    await expect(page.locator("[data-loading-skeleton]")).toHaveCount(0)
    await page.getByRole("button", { name: "Try again", exact: true }).click()
    await expect(page.getByText("No writing published yet. Check back soon.")).toBeVisible()
    await expect(page.getByRole("alert")).toHaveCount(0)
    await expect(page.locator("[data-loading-skeleton]")).toHaveCount(0)
  } finally {
    response.release()
  }
})

for (const view of ["cards", "table"] as const) {
  test(`admin posts preserves its ${view} layout while the first request is pending`, async ({
    page,
  }) => {
    const response = deferred()
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
      key: ADMIN_POSTS_VIEW_STORAGE_KEY,
      value: view,
    })
    await adminSession(page)
    await page.route("**/api/admin/posts/archive*", async (route) => {
      await response.wait
      await route.fulfill({
        json: {
          posts: [{ ...post, status: "draft", publishedAt: null }],
          total: 1,
          page: 1,
          pageCount: 1,
        },
      })
    })
    try {
      await page.goto("/admin/posts")
      const skeleton = await expectLoading(page, "Loading posts…")
      await expect(skeleton.locator(`[data-skeleton-${view}]`)).toBeVisible()
      response.release()
      await expect(page.getByRole("link", { name: post.title, exact: true })).toBeVisible()
      await expect(page.locator("[data-loading-skeleton]")).toHaveCount(0)
      await expect(
        page.getByRole("button", { name: view === "table" ? "Table" : "Cards", exact: true })
      ).toHaveAttribute("aria-pressed", "true")
      await expect(page.getByRole("table")).toHaveCount(view === "table" ? 1 : 0)
    } finally {
      response.release()
    }
  })
}

test("admin overview shows dashboard geometry after access verification while counts load", async ({
  page,
}) => {
  const response = deferred()
  await adminSession(page)
  await page.route("**/api/admin/overview", async (route) => {
    await response.wait
    await route.fulfill({
      json: { total: 5, published: 3, drafts: 2, archived: 0, latestDraft: null },
    })
  })
  try {
    await page.goto("/admin")
    await expectLoading(page, "Loading dashboard…")
    await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible()
    response.release()
    await expect(page.getByText("All posts", { exact: true })).toBeVisible()
    await expect(page.getByText("All posts", { exact: true }).locator("..")).toContainText("5")
    await expect(page.locator("[data-loading-skeleton]")).toHaveCount(0)
  } finally {
    response.release()
  }
})
