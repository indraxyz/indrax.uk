import { expect, test, type Page } from "@playwright/test"

async function fixture(page: Page) {
  await page.route("**/api/admin/session", (route) =>
    route.fulfill({
      json: {
        author: { id: "fixture-author", name: "Author", email: "author@example.test" },
        authConfigured: true,
        databaseConfigured: true,
        coverUploadsConfigured: false,
        previewConfigured: true,
      },
    })
  )
  await page.route("**/api/admin/posts/archive**", (route) =>
    route.fulfill({ json: { posts: [], total: 0, page: 1, pageCount: 0 } })
  )
  await page.route("**/api/admin/tags", (route) => route.fulfill({ json: [] }))
  await page.goto("/admin/posts")
  await expect(page.getByRole("group", { name: "Posts layout" })).toBeVisible()
}

test("admin view preserves raw stored values, reloads and follows another tab including storage clear", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: "browser-fixture",
      url: test.info().project.use.baseURL as string,
    },
  ])
  await fixture(page)
  const table = page.getByRole("button", { name: "Table", exact: true })
  const cards = page.getByRole("button", { name: "Cards", exact: true })
  await table.click()
  await expect(table).toHaveAttribute("aria-pressed", "true")
  expect(await page.evaluate(() => localStorage.getItem("indrax-admin-posts-view"))).toBe("table")
  await page.reload()
  await expect(table).toHaveAttribute("aria-pressed", "true")
  const other = await context.newPage()
  await fixture(other)
  await expect(other.getByRole("button", { name: "Table", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  await other.getByRole("button", { name: "Cards", exact: true }).click()
  await expect(cards).toHaveAttribute("aria-pressed", "true")
  await table.click()
  await expect(other.getByRole("button", { name: "Table", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  await other.evaluate(() => localStorage.clear())
  await expect(cards).toHaveAttribute("aria-pressed", "true")
  await other.evaluate(() => localStorage.setItem("indrax-admin-posts-view", "invalid"))
  await expect(cards).toHaveAttribute("aria-pressed", "true")
  expect(new URL(page.url()).search).toBe("")
})
