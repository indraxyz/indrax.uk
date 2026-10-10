import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

/** These authenticated browser fixtures never create sessions or write real posts. */
async function adminArchive(page: Page) {
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
  await page.route("**/api/admin/tags", (route) =>
    route.fulfill({
      json: [
        { id: "private", slug: "private", name: "Private notes", postCount: 2 },
        { id: "typescript", slug: "typescript", name: "TypeScript", postCount: 4 },
      ],
    })
  )
  await page.route("**/api/admin/posts/archive*", (route) => {
    const params = new URL(route.request().url()).searchParams
    const number = Number(params.get("page") ?? 1)
    return route.fulfill({
      json: {
        posts:
          params.get("q") === "nothing"
            ? []
            : [
                {
                  id: `admin-fixture-${number}`,
                  slug: `admin-fixture-${number}`,
                  title: `Admin archive fixture ${number}`,
                  status: params.get("status") === "published" ? "published" : "draft",
                  publishedAt: null,
                  updatedAt: "2026-10-10T00:00:00Z",
                  tags: [],
                  readingTime: 3,
                  viewCount: 0,
                },
              ],
        total: params.get("q") === "nothing" ? 0 : 21,
        page: number,
        pageCount: params.get("q") === "nothing" ? 0 : 3,
      },
    })
  })
  // Private discovery must never obtain its tag counts or rows from the public APIs.
  await page.route("**/api/writing/**", (route) => route.abort())
}

function params(page: Page) {
  return new URL(page.url()).searchParams
}
async function filters(page: Page) {
  await expect(page.getByRole("heading", { level: 1, name: "Posts", exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Filters and sort" }).click()
  const dialog = page.getByRole("dialog", { name: "Filters and sort" })
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe("admin post discovery", () => {
  test.beforeEach(async ({ page }) => adminArchive(page))

  test("searches private posts and applies status, tags, date, duration, and sort together", async ({
    page,
  }) => {
    await page.goto("/admin/posts?q=renderer&page=2")
    const dialog = await filters(page)
    await dialog.getByLabel("Sort by", { exact: true }).selectOption("oldest")
    await dialog.getByLabel("Status", { exact: true }).selectOption("draft")
    await dialog.getByRole("button", { name: "Private notes (2)", exact: true }).click()
    await dialog.getByRole("button", { name: "TypeScript (4)", exact: true }).click()
    await dialog.getByLabel("Publication date", { exact: true }).selectOption("30d")
    await dialog.getByLabel("Reading duration", { exact: true }).selectOption("short")
    expect(params(page).get("status")).toBeNull()
    await dialog.getByRole("button", { name: "Apply filters" }).click()
    await expect(page).toHaveURL(/status=draft/)
    expect(params(page).getAll("tag")).toEqual(["private", "typescript"])
    expect(params(page).get("sort")).toBe("oldest")
    expect(params(page).get("date")).toBe("30d")
    expect(params(page).get("duration")).toBe("short")
    expect(params(page).get("page")).toBeNull()
    await expect(page.locator("[data-active-filters]")).toBeVisible()
    await page.locator('a[rel="next"]').click()
    await expect(
      page.getByRole("link", { name: "Admin archive fixture 2", exact: true })
    ).toBeVisible()
    expect(params(page).get("status")).toBe("draft")
    expect(params(page).getAll("tag")).toEqual(["private", "typescript"])
    await page.getByRole("searchbox", { name: "Search posts", exact: true }).fill("database")
    await page.getByRole("button", { name: "Search", exact: true }).click()
    await expect(page).toHaveURL(/q=database/)
    expect(params(page).get("page")).toBeNull()
    expect(params(page).get("status")).toBe("draft")
    expect(params(page).get("sort")).toBe("oldest")
    await expect(
      page.getByRole("link", { name: "Admin archive fixture 1", exact: true })
    ).toBeVisible()
  })

  test("clears all controls to the admin defaults while preserving search", async ({ page }) => {
    await page.goto(
      "/admin/posts?q=renderer&status=archived&sort=oldest&tag=private&date=30d&duration=long&page=2"
    )
    const dialog = await filters(page)
    await dialog.getByRole("button", { name: "Clear filters" }).click()
    await expect(page).toHaveURL(/\/admin\/posts\?q=renderer$/)
    await expect(page.locator("[data-active-filters]")).toHaveCount(0)
    const reset = await filters(page)
    await expect(reset.getByLabel("Sort by", { exact: true })).toHaveValue("updated")
    await expect(reset.getByLabel("Status", { exact: true })).toHaveValue("any")
    await expect(
      reset.getByRole("button", { name: "Private notes (2)", exact: true })
    ).toHaveAttribute("aria-pressed", "false")
    await expect(
      reset.getByText("Most recently updated posts first.", { exact: true })
    ).toBeVisible()
  })

  test("closes without applying and restores settings on browser back", async ({ page }) => {
    await page.goto("/admin/posts")
    let dialog = await filters(page)
    await dialog.getByLabel("Status", { exact: true }).selectOption("archived")
    await page.keyboard.press("Escape")
    await expect(dialog).not.toBeVisible()
    await expect(page.getByRole("button", { name: "Filters and sort" })).toBeFocused()
    dialog = await filters(page)
    await expect(dialog.getByLabel("Status", { exact: true })).toHaveValue("any")
    await dialog.getByLabel("Status", { exact: true }).selectOption("published")
    await dialog.getByRole("button", { name: "Apply filters" }).click()
    await expect(page).toHaveURL(/status=published/)
    await page.goBack()
    await expect(page).toHaveURL(/\/admin\/posts$/)
    dialog = await filters(page)
    await expect(dialog.getByLabel("Status", { exact: true })).toHaveValue("any")
  })

  test("explains unavailable relevance in its option and enables it when searching", async ({
    page,
  }) => {
    await page.goto("/admin/posts")
    const dialog = await filters(page)
    const relevance = dialog
      .getByLabel("Sort by", { exact: true })
      .locator('option[value="relevance"]')
    await expect(relevance).toHaveText("Most Relevant (search first to enable)")
    await expect(relevance).toHaveAttribute("disabled", "")
    await page.keyboard.press("Escape")
    await page.getByRole("searchbox", { name: "Search posts", exact: true }).fill("renderer")
    await page.getByRole("button", { name: "Search", exact: true }).click()
    await expect(page).toHaveURL(/q=renderer/)
    const searched = await filters(page)
    await expect(
      searched.getByLabel("Sort by", { exact: true }).locator('option[value="relevance"]')
    ).toHaveText("Most Relevant")
    await searched.getByLabel("Sort by", { exact: true }).selectOption("relevance")
    await expect(
      searched.getByText("Best matches for your search first.", { exact: true })
    ).toBeVisible()
    await searched.getByRole("button", { name: "Apply filters" }).click()
    await expect(page).toHaveURL(/sort=relevance/)
  })

  test("clears the query and page without losing admin status or filters", async ({ page }) => {
    await page.goto("/admin/posts?q=renderer&status=draft&tag=private&sort=oldest&page=2")
    await expect(
      page.getByRole("link", { name: "Admin archive fixture 2", exact: true })
    ).toBeVisible()
    await page.getByRole("button", { name: "Clear search", exact: true }).click()
    await expect(page).not.toHaveURL(/q=|page=/)
    expect(params(page).get("status")).toBe("draft")
    expect(params(page).get("tag")).toBe("private")
    expect(params(page).get("sort")).toBe("oldest")
    const input = page.getByRole("searchbox", { name: "Search posts", exact: true })
    await expect(input).toHaveValue("")
    await expect(input).toBeFocused()
    await input.fill("unsent query")
    const before = page.url()
    await page.getByRole("button", { name: "Clear search", exact: true }).click()
    expect(page.url()).toBe(before)
    await expect(input).toHaveValue("")
    await expect(input).toBeFocused()
  })

  test("supports a phone-sized empty filtered archive with usable controls", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/admin/posts?q=nothing&status=draft&tag=private")
    await expect(page.getByText(/no posts match|nothing matches/i)).toBeVisible()
    const dialog = await filters(page)
    await expect(dialog.getByRole("button", { name: "Apply filters" })).toBeVisible()
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox()
        return box!.x + box!.width
      })
      .toBeLessThanOrEqual(375)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
  })
  for (const theme of ["light", "dark"]) {
    for (const width of [375, 1232]) {
      test(`admin filter sheet accessibility in ${theme} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.addInitScript((value) => localStorage.setItem("indrax-theme", value), theme)
        await page.goto(
          "/admin/posts?status=draft&tag=private&date=custom&from=2026-01-01&duration=short"
        )
        const dialog = await filters(page)
        await dialog.evaluate(async (element) => {
          await Promise.all(element.getAnimations().map((animation) => animation.finished))
        })
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze()
        expect(
          results.violations
            .filter(
              (violation) => violation.impact === "serious" || violation.impact === "critical"
            )
            .map((violation) => ({
              id: violation.id,
              nodes: violation.nodes.map((node) => node.target.join(" ")),
            }))
        ).toEqual([])
      })
    }
  }
})
