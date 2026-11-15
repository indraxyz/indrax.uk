import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"
import { THEME_STORAGE_KEY } from "../lib/theme"

const DRAFT_ID = "550e8400-e29b-41d4-a716-446655440001"

async function dashboardFixture(page: Page, hasDraft = true) {
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: "dashboard-fixture",
      url: test.info().project.use.baseURL as string,
    },
  ])
  const queries: string[] = []
  await page.route("**/api/admin/**", (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith("/session"))
      return route.fulfill({
        json: {
          author: { id: "fixture", name: "Indra", email: "author@example.test" },
          authConfigured: true,
          databaseConfigured: true,
          coverUploadsConfigured: false,
          previewConfigured: true,
        },
      })
    if (url.pathname.endsWith("/overview"))
      return route.fulfill({
        json: {
          total: 6,
          published: 3,
          drafts: 2,
          archived: 1,
          latestDraft: hasDraft ? { id: DRAFT_ID, title: "Draft to continue" } : null,
        },
      })
    if (url.pathname.endsWith("/archive")) {
      queries.push(url.search)
      return route.fulfill({ json: { posts: [], total: 0, page: 1, pageCount: 0 } })
    }
    if (url.pathname.endsWith("/tags")) return route.fulfill({ json: [] })
    return route.fulfill({ status: 404, json: { error: "Unexpected fixture request" } })
  })
  await page.goto("/admin")
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible()
  return queries
}

for (const width of [320, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`icon navigation and actionable dashboard cards work at ${width}px in ${theme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.addInitScript(({ key, theme }) => localStorage.setItem(key, theme), {
        key: THEME_STORAGE_KEY,
        theme,
      })
      await page.goto("/resume")
      const publicNav = page.getByRole("navigation", { name: "Site", exact: true })
      for (const name of ["Home", "Resume", "Writing", "Stack"]) {
        const link = publicNav.getByRole("link", { name, exact: true })
        await expect(link).toHaveText("")
        await expect(link).toHaveAttribute("title", name)
        await expect(link.locator("svg")).toHaveCount(1)
        const box = (await link.boundingBox())!
        expect(box.width).toBeGreaterThanOrEqual(44)
        expect(box.height).toBeGreaterThanOrEqual(44)
      }
      await page.screenshot({ path: test.info().outputPath(`public-icons-${width}-${theme}.png`) })
      await page
        .locator("header")
        .screenshot({ path: test.info().outputPath(`public-header-${width}-${theme}.png`) })
      const queries = await dashboardFixture(page)
      const header = page.locator("header")
      if (width >= 900) {
        for (const name of ["Dashboard", "Posts"]) {
          const link = header.getByRole("link", { name, exact: true })
          await expect(link).toHaveText("")
          await expect(link).toHaveAttribute("title", name)
          await expect(link.locator("svg")).toHaveCount(1)
          const box = (await link.boundingBox())!
          expect(box.width).toBeGreaterThanOrEqual(44)
          expect(box.height).toBeGreaterThanOrEqual(44)
        }
        const publicButton = header.getByRole("button", { name: "Public", exact: true })
        await expect(publicButton).toHaveText("")
        await expect(publicButton.locator("svg")).toHaveCount(1)
      }
      const summary = page.getByRole("region", { name: "Posts", exact: true })
      const all = summary.getByRole("link", { name: /^All posts:/ })
      await page.mouse.move(0, 0)
      await expect(all).toHaveCSS("box-shadow", "none")
      await expect(all).toHaveCSS("cursor", "pointer")
      const face = all.locator('[data-slot="dashboard-card-face"]')
      const shadow = all.locator('[data-slot="dashboard-card-shadow"]')
      const original = (await all.boundingBox())!
      const faceBefore = (await face.boundingBox())!
      await expect(shadow).toHaveCSS("opacity", "0")
      await all.hover()
      await expect(shadow).toHaveCSS("opacity", "1")
      const raised = (await face.boundingBox())!
      expect(raised.x).toBeCloseTo(faceBefore.x - 4, 0)
      expect(raised.y).toBeCloseTo(faceBefore.y - 4, 0)
      expect((await shadow.boundingBox())!.x).toBeCloseTo(original.x, 0)
      expect((await shadow.boundingBox())!.y).toBeCloseTo(original.y, 0)
      expect((await all.boundingBox())!.x).toBeCloseTo(original.x, 0)
      expect((await all.boundingBox())!.y).toBeCloseTo(original.y, 0)
      await page.screenshot({
        path: test.info().outputPath(`dashboard-hover-${width}-${theme}.png`),
      })
      await page.mouse.down()
      await expect(shadow).toHaveCSS("opacity", "0")
      await expect.poll(async () => (await face.boundingBox())!.x).toBeCloseTo(faceBefore.x, 0)
      await expect.poll(async () => (await face.boundingBox())!.y).toBeCloseTo(faceBefore.y, 0)
      await page.screenshot({
        path: test.info().outputPath(`dashboard-pressed-${width}-${theme}.png`),
      })
      // Release away from the card so this geometry check does not navigate.
      await page.mouse.move(0, 0)
      await page.mouse.up()
      await expect(shadow).toHaveCSS("opacity", "0")
      expect((await face.boundingBox())!.x).toBeCloseTo(faceBefore.x, 0)
      expect((await face.boundingBox())!.y).toBeCloseTo(faceBefore.y, 0)
      const continuation = page.getByRole("link", { name: "Edit draft", exact: true })
      await expect(continuation).toHaveAttribute("href", `/admin/posts/edit/${DRAFT_ID}`)
      await expect(continuation).toHaveCSS("box-shadow", "none")
      await expect(
        page.getByRole("region", { name: "Workspace services", exact: true }).getByRole("link")
      ).toHaveCount(0)
      const results = await new AxeBuilder({ page }).include("main").analyze()
      expect(
        results.violations.filter(({ impact }) => impact === "serious" || impact === "critical")
      ).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      )
      await page.screenshot({
        path: test.info().outputPath(`dashboard-${width}-${theme}.png`),
        fullPage: true,
      })
      for (const [label, status] of [
        ["All posts", ""],
        ["Published", "published"],
        ["Drafts", "draft"],
        ["Archived", "archived"],
      ]) {
        await summary.getByRole("link", { name: new RegExp(`^${label}:`) }).click()
        await expect(page.getByRole("heading", { name: "Posts", exact: true })).toBeVisible()
        await expect.poll(() => new URL(page.url()).searchParams.get("status") ?? "").toBe(status)
        await expect
          .poll(() => new URLSearchParams(queries.at(-1)).get("status") ?? "")
          .toBe(status)
        await page.goto("/admin")
      }
      await page.getByRole("link", { name: "Edit draft", exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`/admin/posts/edit/${DRAFT_ID}$`))
    })
  }
}

test("dashboard writing card starts a new post when there is no draft", async ({ page }) => {
  await dashboardFixture(page, false)
  await page
    .getByRole("region", { name: "Continue writing", exact: true })
    .getByRole("link", { name: "New post", exact: true })
    .click()
  await expect(page).toHaveURL(/\/admin\/posts\/new$/)
})

test("dashboard card hover respects reduced motion with a stationary face", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await dashboardFixture(page)
  const card = page.getByRole("link", { name: /^All posts:/ })
  const face = card.locator('[data-slot="dashboard-card-face"]')
  const before = (await face.boundingBox())!
  await card.hover()
  await expect(face).toHaveCSS("transition-property", "none")
  const after = (await face.boundingBox())!
  expect(after.x).toBeCloseTo(before.x, 0)
  expect(after.y).toBeCloseTo(before.y, 0)
  await expect(face).not.toHaveCSS("box-shadow", "none")
})
