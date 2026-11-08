import { expect, test, type Page } from "@playwright/test"

async function archiveFixture(page: Page, admin: boolean, failTags = false) {
  const prefix = admin ? "/api/admin" : "/api/writing"
  const calls = { posts: 0, tags: 0 }
  if (admin) {
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
  }
  await page.route(`**${prefix}/tags`, (route) => {
    calls.tags++
    return failTags && calls.tags === 1
      ? route.fulfill({ status: 503, json: { message: "Unavailable" } })
      : route.fulfill({
          json: [{ id: "typescript", slug: "typescript", name: "TypeScript", postCount: 2 }],
        })
  })
  await page.route(`**${prefix}/posts${admin ? "/archive" : ""}*`, (route) => {
    calls.posts++
    const number = Number(new URL(route.request().url()).searchParams.get("page") ?? 1)
    return route.fulfill({
      json: {
        posts: [
          {
            id: `budget-${number}`,
            slug: `budget-${number}`,
            title: `Query budget page ${number}`,
            excerpt: "Query budget fixture",
            coverUrl: null,
            coverAlt: null,
            publishedAt: "2026-11-01T00:00:00Z",
            updatedAt: "2026-11-01T00:00:00Z",
            status: "published",
            readingTime: 2,
            tags: [],
          },
        ],
        total: 2,
        page: number,
        pageCount: 2,
      },
    })
  })
  return calls
}

for (const admin of [false, true]) {
  const surface = admin ? "admin posts" : "public writing"
  const path = admin ? "/admin/posts" : "/writing"

  test(`${surface} fetches tags only on demand and reuses warm results`, async ({ page }) => {
    const calls = await archiveFixture(page, admin)
    await page.goto(path)
    await expect(page.getByRole("link", { name: "Query budget page 1", exact: true })).toBeVisible()
    expect(calls).toEqual({ posts: 1, tags: 0 })

    await page.getByRole("link", { name: "Next", exact: true }).click()
    await expect(page.getByRole("link", { name: "Query budget page 2", exact: true })).toBeVisible()
    expect(calls).toEqual({ posts: 2, tags: 0 })

    const filters = page.getByRole("button", { name: "Filters and sort", exact: true })
    await filters.click()
    const sheet = page.getByRole("dialog", { name: "Filters and sort", exact: true })
    await expect(sheet.getByRole("button", { name: "TypeScript (2)", exact: true })).toBeVisible()
    expect(calls).toEqual({ posts: 2, tags: 1 })
    await page.keyboard.press("Escape")
    await expect(sheet).not.toBeVisible()

    await page.getByRole("link", { name: "Previous", exact: true }).click()
    await expect(page.getByRole("link", { name: "Query budget page 1", exact: true })).toBeVisible()
    expect(calls).toEqual({ posts: 2, tags: 1 })
    await filters.click()
    await expect(sheet.getByRole("button", { name: "TypeScript (2)", exact: true })).toBeVisible()
    expect(calls).toEqual({ posts: 2, tags: 1 })
  })

  test(`${surface} retains an explicit retry for failed on-demand tags`, async ({ page }) => {
    const calls = await archiveFixture(page, admin, true)
    await page.goto(path)
    await expect(page.getByRole("link", { name: "Query budget page 1", exact: true })).toBeVisible()
    expect(calls.tags).toBe(0)
    await page.getByRole("button", { name: "Filters and sort", exact: true }).click()
    const sheet = page.getByRole("dialog", { name: "Filters and sort", exact: true })
    await sheet.getByRole("button", { name: "Try again", exact: true }).click()
    await expect(sheet.getByRole("button", { name: "TypeScript (2)", exact: true })).toBeVisible()
    expect(calls).toEqual({ posts: 1, tags: 2 })
  })
}
