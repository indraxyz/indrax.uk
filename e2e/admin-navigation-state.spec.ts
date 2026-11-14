import { expect, test } from "@playwright/test"

test("nested public menu, route changes and breakpoints keep drawer state coordinated", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 650 })
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
        author: { id: "fixture-author", name: "Author", email: "author@example.test" },
        authConfigured: true,
        databaseConfigured: true,
        coverUploadsConfigured: false,
        previewConfigured: true,
      },
    })
  )
  await page.route("**/api/admin/tags", (route) => route.fulfill({ json: [] }))
  await page.route("**/api/admin/posts/archive**", (route) =>
    route.fulfill({ json: { posts: [], total: 0, page: 1, pageCount: 0 } })
  )
  await page.goto("/admin/posts/new")
  const header = page.locator("[data-admin-header]")
  const drawer = page.getByRole("dialog", { name: "Admin menu", exact: true })
  await header.getByRole("button", { name: "Open admin menu" }).click()
  await expect(drawer).toBeVisible()
  await drawer.getByRole("button", { name: "Public", exact: true }).click()
  await expect(page.getByRole("menuitem", { name: "Resume", exact: true })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("menuitem", { name: "Resume", exact: true })).toBeHidden()
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole("button", { name: "Public", exact: true })).toBeFocused()
  await page.evaluate(() => window.scrollBy({ top: 300, behavior: "instant" }))
  await expect(header).toHaveAttribute("data-scroll-hidden", "false")
  await drawer.getByRole("link", { name: "Posts", exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/posts$/)
  await expect(drawer).toBeHidden()
  await header.getByRole("button", { name: "Open admin menu" }).click()
  await expect(drawer).toBeVisible()
  await page.setViewportSize({ width: 1280, height: 650 })
  await expect(drawer).toBeHidden()
  await header.getByRole("button", { name: "Public", exact: true }).click()
  await expect(page.getByRole("menuitem", { name: "Resume", exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 650 })
  await expect(page.getByRole("menuitem", { name: "Resume", exact: true })).toBeHidden()
  await header.getByRole("button", { name: "Open admin menu" }).click()
  await expect(drawer).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(drawer).toBeHidden()
  await expect(header.getByRole("button", { name: "Open admin menu" })).toBeFocused()
})
