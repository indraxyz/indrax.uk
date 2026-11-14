import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"
import { THEME_STORAGE_KEY } from "../lib/theme"

const ids = [1, 2, 3].map((n) => `550e8400-e29b-41d4-a716-44665544000${n}`)
async function fixture(page: Page) {
  const posts = (["draft", "published", "archived"] as const).map((status, index) => ({
    id: ids[index],
    title: `${status} fixture`,
    slug: `${status}-fixture`,
    status: status as string,
    excerpt: "Fixture",
    coverUrl: null,
    coverAlt: null,
    publishedAt: null,
    updatedAt: "2026-01-01T00:00:00Z",
    tags: [],
    readingTime: 1,
    viewCount: 0,
  }))
  const writes: { id: string; status: string }[] = []
  const failures = new Map<string, number>()
  let gate: Promise<void> | undefined
  let expired = false
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: "fixture",
      url: test.info().project.use.baseURL as string,
    },
  ])
  await page.route("**/api/admin/**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === "/api/admin/session")
      return route.fulfill({
        json: {
          author: expired ? null : { id: "author", name: "Author", email: "author@example.test" },
          authConfigured: true,
          databaseConfigured: true,
          coverUploadsConfigured: false,
          previewConfigured: true,
        },
      })
    if (path === "/api/admin/tags") return route.fulfill({ json: [] })
    if (path === "/api/admin/posts/archive")
      return route.fulfill({
        json: {
          posts,
          total: 30,
          page: Number(new URL(request.url()).searchParams.get("page") ?? 1),
          pageCount: 3,
        },
      })
    if (path.endsWith("/status")) {
      const id = path.split("/")[4]
      const { status } = request.postDataJSON()
      writes.push({ id, status })
      if (gate) await gate
      const failure = failures.get(id)
      if (failure) {
        if ([401, 403].includes(failure)) expired = true
        return route.fulfill({
          status: failure,
          json: { ok: false, message: "Fixture validation refused." },
        })
      }
      const post = posts.find((post) => post.id === id)!
      post.status = status
      return route.fulfill({
        json: {
          ok: true,
          postId: id,
          postState: { id, status, publishedAt: null, updatedAt: "2026-01-02T00:00:00Z" },
        },
      })
    }
    if (path === "/api/admin/overview")
      return route.fulfill({
        json: { total: 3, published: 1, drafts: 1, archived: 1, latestDraft: null },
      })
    return route.fulfill({ status: 404, json: { error: "Unexpected fixture request" } })
  })
  await page.goto("/admin/posts")
  await expect(
    page.getByRole("checkbox", { name: "Select draft fixture", exact: true })
  ).toBeVisible()
  return {
    posts,
    writes,
    failures,
    hold: (promise: Promise<void>) => {
      gate = promise
    },
  }
}
const selection = (page: Page) => page.getByRole("region", { name: "Post selection" })
async function chooseAction(page: Page, action: string) {
  await page.getByRole("button", { name: "Bulk post actions", exact: true }).click()
  await page.getByRole("menuitem", { name: action, exact: true }).click()
}
async function confirm(page: Page, action: string, count: number) {
  await chooseAction(page, action)
  const dialog = page.getByRole("alertdialog", { name: `${action} selected posts?`, exact: true })
  await dialog.getByRole("button", { name: `${action} ${count} posts`, exact: true }).click()
}

for (const theme of ["light", "dark"] as const) {
  test(`native post checkboxes match the ${theme} theme in cards and table`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(({ key, theme }) => localStorage.setItem(key, theme), {
      key: THEME_STORAGE_KEY,
      theme,
    })
    await fixture(page)
    const checkbox = page.getByRole("checkbox", { name: "Select draft fixture", exact: true })
    await expect(checkbox).toHaveCSS("appearance", "none")
    await expect(checkbox).toHaveCSS("border-radius", "0px")
    await expect(checkbox).toHaveCSS("border-top-width", "2px")
    const target = (await checkbox.locator("xpath=../..").boundingBox())!
    expect(target.width).toBeGreaterThanOrEqual(44)
    expect(target.height).toBeGreaterThanOrEqual(44)
    await checkbox.focus()
    await page.keyboard.press("Space")
    await expect(checkbox).toBeChecked()
    await expect(checkbox).toBeFocused()
    await expect(checkbox).not.toHaveCSS("box-shadow", "none")
    await expect(checkbox).toHaveCSS(
      "background-color",
      theme === "light" ? "rgb(6, 59, 0)" : "rgb(225, 225, 0)"
    )
    await expect(checkbox.locator("..").locator("svg.lucide-check")).toBeVisible()
    const all = page.getByRole("checkbox", { name: "Select all posts on this page" })
    await expect(all).toHaveJSProperty("indeterminate", true)
    await expect(all.locator("..").locator("svg.lucide-minus")).toBeVisible()
    await expect(all.locator("..").locator("svg.lucide-check")).toBeHidden()
    await page.screenshot({
      path: test.info().outputPath(`checkbox-cards-${theme}.png`),
      fullPage: true,
    })
    const actionTrigger = page.getByRole("button", { name: "Bulk post actions", exact: true })
    await actionTrigger.focus()
    await page.keyboard.press("Enter")
    const menu = page.getByRole("menu", { name: "Bulk post actions", exact: true })
    await expect(
      menu.getByRole("menuitem", { name: "Change to draft", exact: true })
    ).toHaveAttribute("aria-disabled", "true")
    await expect(menu).toHaveCSS("box-shadow", "none")
    const glassBackground = theme === "light" ? "rgba(0, 0, 0, 0.6)" : "rgba(255, 255, 255, 0.6)"
    await expect(menu).toHaveCSS("background-color", glassBackground)
    await expect(menu).toHaveCSS(
      "color",
      theme === "light" ? "rgb(255, 255, 255)" : "rgb(6, 59, 0)"
    )
    await expect(selection(page)).toHaveCSS("background-color", glassBackground)
    await expect(menu).toHaveCSS("backdrop-filter", /blur\(/)
    await expect(selection(page)).toHaveCSS("box-shadow", "none")
    await expect(selection(page)).toHaveCSS("backdrop-filter", /blur\(/)
    const menuResults = await new AxeBuilder({ page }).include('[role="menu"]').analyze()
    expect(menuResults.violations).toEqual([])
    await page.screenshot({ path: test.info().outputPath(`floating-menu-${theme}.png`) })
    await page.keyboard.press("Escape")
    await expect(actionTrigger).toBeFocused()
    await all.check()
    await expect(all.locator("..").locator("svg.lucide-check")).toBeVisible()
    await expect(all.locator("..").locator("svg.lucide-minus")).toBeHidden()
    await page.getByRole("button", { name: "Table", exact: true }).click()
    await expect(checkbox).toBeChecked()
    await expect(checkbox).toHaveCSS("appearance", "none")
    await page.screenshot({
      path: test.info().outputPath(`checkbox-table-${theme}.png`),
      fullPage: true,
    })
    const results = await new AxeBuilder({ page }).include("main").analyze()
    expect(
      results.violations.filter(({ impact }) => impact === "serious" || impact === "critical")
    ).toEqual([])
  })
}

test("post checkboxes retain native indicators and keyboard behavior in forced colors", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active" })
  await fixture(page)
  const checkbox = page.getByRole("checkbox", { name: "Select draft fixture", exact: true })
  await expect(checkbox).toHaveCSS("appearance", "auto")
  await checkbox.focus()
  await expect(checkbox).toHaveCSS("outline-style", "solid")
  await expect(checkbox).toHaveCSS("outline-width", "2px")
  await page.keyboard.press("Space")
  await expect(checkbox).toBeChecked()
  await expect(checkbox.locator("..").locator("svg.lucide-check")).toBeHidden()
  const all = page.getByRole("checkbox", { name: "Select all posts on this page" })
  await expect(all).toHaveJSProperty("indeterminate", true)
  await expect(all.locator("..").locator("svg.lucide-minus")).toBeHidden()
  await all.focus()
  await page.keyboard.press("Space")
  await expect(all).toBeChecked()
  await expect(all).toHaveJSProperty("indeterminate", false)
  await expect(
    page.getByRole("checkbox", { name: "Select published fixture", exact: true })
  ).toBeChecked()
})

for (const width of [320, 1280]) {
  test(`card selection and compact bulk actions fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await fixture(page)
    await expect(selection(page)).toHaveCount(0)
    const card = page.getByRole("listitem").filter({ hasText: "draft fixture" })
    const checkbox = card.getByRole("checkbox", { name: "Select draft fixture", exact: true })
    const status = card.getByText("draft", { exact: true })
    const checkboxBox = (await checkbox.boundingBox())!
    const statusBox = (await status.boundingBox())!
    expect(checkboxBox.width).toBeGreaterThanOrEqual(20)
    expect(checkboxBox.x + checkboxBox.width).toBeLessThan(statusBox.x)
    expect(checkboxBox.y).toBeLessThan(statusBox.y + statusBox.height)
    await checkbox.check()
    await expect(selection(page).getByRole("status")).toHaveText("1 selected")
    for (const name of ["Clear selection", "Bulk post actions"]) {
      const button = selection(page).getByRole("button", { name, exact: true })
      await expect(button).toHaveText("")
      await expect(button).toHaveAttribute("title", name)
      const bounds = (await button.boundingBox())!
      expect(bounds.width).toBeGreaterThanOrEqual(44)
      expect(bounds.height).toBeGreaterThanOrEqual(44)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width
    )
    const floating = selection(page)
    await expect(floating).toHaveCSS("position", "fixed")
    const initial = (await floating.boundingBox())!
    expect(initial.x).toBeGreaterThanOrEqual(16)
    expect(initial.x + initial.width).toBeLessThanOrEqual(width - 16)
    expect(initial.height).toBeLessThanOrEqual(80)
    expect(900 - initial.y - initial.height).toBeCloseTo(16, 0)
    await page.screenshot({ path: test.info().outputPath(`bulk-actions-${width}.png`) })

    const trigger = page.getByRole("button", { name: "Bulk post actions", exact: true })
    await trigger.focus()
    await page.keyboard.press("Enter")
    const menu = page.getByRole("menu", { name: "Bulk post actions", exact: true })
    await expect(menu.getByRole("menuitem")).toHaveText(["Publish", "Change to draft", "Archive"])
    await expect(menu.getByRole("menuitem", { name: "Publish", exact: true })).toBeFocused()
    await page.keyboard.press("ArrowDown")
    const unavailable = menu.getByRole("menuitem", { name: "Change to draft", exact: true })
    await expect(unavailable).toBeFocused()
    await expect(unavailable).toHaveAttribute("aria-disabled", "true")
    await page.keyboard.press("Enter")
    await expect(page.getByRole("alertdialog")).toHaveCount(0)
    await page.keyboard.press("ArrowDown")
    await expect(menu.getByRole("menuitem", { name: "Archive", exact: true })).toBeFocused()
    const menuBox = (await menu.boundingBox())!
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(initial.y)
    expect(menuBox.x).toBeGreaterThanOrEqual(0)
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(width)
    await page.screenshot({ path: test.info().outputPath(`bulk-menu-${width}.png`) })
    await page.keyboard.press("Escape")
    await expect(trigger).toBeFocused()

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    expect((await floating.boundingBox())!.y).toBeCloseTo(initial.y, 0)
    const theme = page.locator("footer").getByRole("button", { name: /Switch theme/ })
    await theme.focus()
    await expect
      .poll(() =>
        theme.evaluate((node) => {
          const bounds = node.getBoundingClientRect()
          const front = document.elementFromPoint(
            bounds.x + bounds.width / 2,
            bounds.y + bounds.height / 2
          )
          return !!front && node.contains(front)
        })
      )
      .toBe(true)
    await page.getByRole("button", { name: "Clear selection", exact: true }).click()
    await expect(floating).toHaveCount(0)
    await expect(page.locator("body")).toHaveCSS("padding-bottom", "0px")
  })
}

test("selection follows cards/table, mixed state, clear, URL changes and navigation", async ({
  page,
}) => {
  await fixture(page)
  await expect(selection(page)).toHaveCount(0)
  await page.getByRole("checkbox", { name: "Select draft fixture", exact: true }).check()
  const all = page.getByRole("checkbox", { name: "Select all posts on this page" })
  await expect(all).toHaveJSProperty("indeterminate", true)
  await page.getByRole("button", { name: "Table", exact: true }).click()
  await expect(
    page.getByRole("checkbox", { name: "Select draft fixture", exact: true })
  ).toBeChecked()
  await all.check()
  await expect(selection(page).getByRole("status")).toHaveText("3 selected")
  expect(
    (await new AxeBuilder({ page }).include('section[aria-label="Post selection"]').analyze())
      .violations
  ).toEqual([])
  await page.getByRole("button", { name: "Clear selection" }).click()
  await expect(selection(page)).toHaveCount(0)
  await expect(
    page.getByRole("checkbox", { name: "Select draft fixture", exact: true })
  ).toBeFocused()
  await page.getByRole("checkbox", { name: "Select draft fixture", exact: true }).check()
  await page.getByRole("button", { name: /Title: sort/ }).click()
  await expect(selection(page)).toHaveCount(0)
  await page.getByRole("checkbox", { name: "Select draft fixture", exact: true }).check()
  await page.getByRole("link", { name: "Dashboard", exact: true }).click()
  await page.getByRole("link", { name: "Posts", exact: true }).first().click()
  await expect(
    page.getByRole("checkbox", { name: "Select draft fixture", exact: true })
  ).not.toBeChecked()
})

for (const [status, action] of [
  ["published", "Publish"],
  ["draft", "Change to draft"],
  ["archived", "Archive"],
]) {
  test(`${action} selected skips existing target status and requires confirmation`, async ({
    page,
  }) => {
    const state = await fixture(page)
    await page.getByRole("checkbox", { name: "Select draft fixture", exact: true }).check()
    await page.getByRole("checkbox", { name: "Select all posts on this page" }).check()
    await chooseAction(page, action)
    const dialog = page.getByRole("alertdialog")
    await expect(dialog).toContainText(`${action} 2 posts`)
    await expect(dialog).toContainText(`1 already ${status}; skipped.`)
    if (status === "published") await expect(dialog).toContainText("visible to everyone")
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(page.getByRole("button", { name: "Bulk post actions", exact: true })).toBeFocused()
    expect(state.writes).toHaveLength(0)
    await confirm(page, action, 2)
    await expect(page.getByRole("status").filter({ hasText: /updated/ })).toContainText(
      "2 updated. 0 not confirmed"
    )
    await expect(
      page.getByRole("checkbox", { name: "Select draft fixture", exact: true })
    ).toBeFocused()
    expect(state.writes).toHaveLength(2)
    expect(state.writes.every((write) => write.status === status)).toBe(true)
    await expect(selection(page)).toHaveCount(0)
  })
}

test("background refresh narrows an open confirmation without adding new targets", async ({
  page,
}) => {
  const state = await fixture(page)
  await page.getByRole("checkbox", { name: "Select draft fixture", exact: true }).check()
  await page.getByRole("checkbox", { name: "Select all posts on this page" }).check()

  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route("**/api/admin/posts/archive*", async (route) => {
    await gate
    await route.fallback()
  })
  await page.getByRole("button", { name: "Refresh posts", exact: true }).click()
  await chooseAction(page, "Archive")
  const dialog = page.getByRole("alertdialog")
  await expect(dialog.getByRole("button", { name: "Archive 2 posts", exact: true })).toBeEnabled()

  // A post in the approved snapshot no longer needs the action; a previously
  // excluded post now does. Only the remaining approved post may be changed.
  state.posts[0].status = "archived"
  state.posts[2].status = "published"
  const refreshed = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/admin/posts/archive"
  )
  release()
  await refreshed
  await expect(dialog).toContainText("1 already archived; skipped.")
  await dialog.getByRole("button", { name: "Archive 1 posts", exact: true }).click()
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  expect(state.writes).toEqual([{ id: ids[1], status: "archived" }])
  expect(state.posts[2].status).toBe("published")
})

test("partial failures retain only failed selections and user retry targets only those posts", async ({
  page,
}) => {
  const state = await fixture(page)
  state.failures.set(ids[1], 422)
  await page.getByRole("checkbox", { name: "Select draft fixture", exact: true }).check()
  await page.getByRole("checkbox", { name: "Select all posts on this page" }).check()
  await confirm(page, "Archive", 2)
  await expect(page.getByRole("status").filter({ hasText: /updated/ })).toContainText(
    "1 updated. 1 not confirmed"
  )
  await expect(
    page.getByRole("checkbox", { name: "Select published fixture", exact: true })
  ).toBeChecked()
  await expect(
    page.getByRole("checkbox", { name: "Select draft fixture", exact: true })
  ).not.toBeChecked()
  state.failures.clear()
  await confirm(page, "Archive", 1)
  await expect(page.getByRole("status").filter({ hasText: /updated/ })).toContainText(
    "1 updated. 0 not confirmed"
  )
  expect(state.writes.map(({ id }) => id)).toEqual([ids[0], ids[1], ids[1]])
})

test("pending bulk writes block duplicate and individual actions", async ({ page }) => {
  const state = await fixture(page)
  let release!: () => void
  state.hold(
    new Promise<void>((resolve) => {
      release = resolve
    })
  )
  await page.getByRole("checkbox", { name: "Select draft fixture", exact: true }).check()
  await page.getByRole("checkbox", { name: "Select all posts on this page" }).check()
  await confirm(page, "Archive", 2)
  await expect.poll(() => state.writes.length).toBe(1)
  await expect(
    page.getByRole("alertdialog").getByRole("button", { name: "Updating…" })
  ).toBeDisabled()
  await expect(
    page.getByRole("checkbox", { name: "Select draft fixture", exact: true, includeHidden: true })
  ).toBeDisabled()
  release()
  await expect(page.getByRole("status").filter({ hasText: /updated/ })).toContainText("2 updated")
  expect(state.writes).toHaveLength(2)
})

test("authorization expiry stops subsequent writes and resets selection on login", async ({
  page,
}) => {
  const state = await fixture(page)
  state.failures.set(ids[0], 401)
  await page.getByRole("checkbox", { name: "Select draft fixture", exact: true }).check()
  await page.getByRole("checkbox", { name: "Select all posts on this page" }).check()
  await confirm(page, "Archive", 2)
  await expect(page).toHaveURL(/\/admin\/login$/)
  expect(state.writes).toHaveLength(1)
})

test("changing archive URL stops old bulk work without clearing new selections", async ({
  page,
}) => {
  const state = await fixture(page)
  await page.getByRole("button", { name: "Table", exact: true }).click()
  await page.getByRole("button", { name: /Title: sort/ }).click()
  await expect(page).toHaveURL(/sort=/)
  let release!: () => void
  state.hold(
    new Promise<void>((resolve) => {
      release = resolve
    })
  )
  await page.getByRole("checkbox", { name: "Select draft fixture", exact: true }).check()
  await page.getByRole("checkbox", { name: "Select all posts on this page" }).check()
  await confirm(page, "Archive", 2)
  await expect.poll(() => state.writes.length).toBe(1)
  await page.goBack()
  await expect(page).toHaveURL(/\/admin\/posts$/)
  await expect(page.getByRole("alertdialog")).toHaveCount(0)
  const nextSelection = page.getByRole("checkbox", {
    name: "Select published fixture",
    exact: true,
  })
  await expect(nextSelection).toBeEnabled()
  await nextSelection.check()
  const refreshed = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/admin/posts/archive"
  )
  release()
  await refreshed
  expect(state.writes).toHaveLength(1)
  await expect(nextSelection).toBeChecked()
})
