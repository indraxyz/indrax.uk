import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

for (const theme of ["light", "dark"]) {
  for (const view of ["cards", "table"]) {
    test(`${view} statuses use readable text and distinct balanced underlines in ${theme}`, async ({
      page,
    }) => {
      await page.addInitScript(
        ({ theme, view }) => {
          localStorage.setItem("indrax-theme", theme)
          localStorage.setItem("indrax-admin-posts-view", view)
        },
        { theme, view }
      )
      await page.context().addCookies([
        {
          name: "better-auth.session_token",
          value: "fixture",
          url: test.info().project.use.baseURL as string,
        },
      ])
      await page.route("**/api/admin/**", (route) => {
        if (new URL(route.request().url()).pathname.endsWith("/session"))
          return route.fulfill({
            json: {
              author: { id: "author", name: "Author", email: "author@example.test" },
              authConfigured: true,
              databaseConfigured: true,
              coverUploadsConfigured: false,
              previewConfigured: true,
            },
          })
        return route.fulfill({
          json: {
            posts: ["draft", "published", "archived"].map((status, index) => ({
              id: `status-${index}`,
              title: `${status} article`,
              slug: `status-${index}`,
              status,
              excerpt: "Status presentation fixture",
              tags: [],
              coverUrl: null,
              coverAlt: null,
              publishedAt: null,
              updatedAt: "2026-01-01T00:00:00Z",
            })),
            total: 3,
            page: 1,
            pageCount: 1,
          },
        })
      })
      await page.goto("/admin/posts")
      if (view === "table") await expect(page.getByRole("table")).toBeVisible()
      else await expect(page.getByRole("table")).toHaveCount(0)
      const colors: string[] = []
      for (const status of ["draft", "published", "archived"]) {
        const label = page.locator(`[data-post-status="${status}"]`)
        await expect(label).toHaveText(status)
        await expect(label).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
        await expect(label).toHaveCSS("text-decoration-line", "underline")
        await expect(label).toHaveCSS("text-decoration-thickness", "3px")
        colors.push(await label.evaluate((el) => getComputedStyle(el).textDecorationColor))
      }
      expect(new Set(colors).size).toBe(3)
      const results = await new AxeBuilder({ page }).include("main").analyze()
      expect(
        results.violations.filter(({ impact }) => impact === "serious" || impact === "critical")
      ).toEqual([])
    })
  }
}
