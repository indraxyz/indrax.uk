import { expect, test, type Page } from "@playwright/test"

/** Browser behavior uses isolated API responses; no writes to the development database. */
async function archive(page: Page) {
  await page.route("**/api/writing/tags", (route) =>
    route.fulfill({
      json: [
        { id: "typescript", slug: "typescript", name: "TypeScript", postCount: 12 },
        { id: "react", slug: "react", name: "React", postCount: 5 },
      ],
    })
  )
  await page.route("**/api/writing/posts*", (route) => {
    const params = new URL(route.request().url()).searchParams
    const pageNumber = Number(params.get("page") ?? 1)
    return route.fulfill({
      json: {
        posts:
          params.get("q") === "nothing"
            ? []
            : [
                {
                  id: `fixture-${pageNumber}`,
                  slug: `fixture-${pageNumber}`,
                  title: `Archive fixture ${pageNumber}`,
                  excerpt: "An isolated browser fixture",
                  coverUrl: null,
                  coverAlt: null,
                  publishedAt: "2026-10-09T00:00:00Z",
                  updatedAt: "2026-10-09T00:00:00Z",
                  readingTime: 3,
                  tags: [],
                },
              ],
        page: pageNumber,
        pageCount: params.get("q") === "nothing" ? 1 : 3,
        total: params.get("q") === "nothing" ? 0 : 21,
      },
    })
  })
}

function params(page: Page) {
  return new URL(page.url()).searchParams
}

async function openFilters(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: /articles?/ })).toBeVisible()
  await page.getByRole("button", { name: "Filters and sort" }).click()
  const dialog = page.getByRole("dialog", { name: "Filters and sort" })
  await expect(dialog).toBeVisible()
  return dialog
}

test.describe("unified writing filters", () => {
  test.beforeEach(async ({ page }) => archive(page))

  test("applies a draft together, preserves all filters in pagination and search", async ({
    page,
  }) => {
    await page.goto("/writing?q=renderer&page=2")
    const dialog = await openFilters(page)
    await dialog.getByRole("button", { name: /TypeScript.*12/i }).click()
    await dialog.getByRole("button", { name: /React.*5/i }).click()
    await dialog.getByLabel("Sort by", { exact: true }).selectOption("oldest")
    await dialog.getByLabel("Publication date", { exact: true }).selectOption("30d")
    await dialog.getByLabel("Reading duration", { exact: true }).selectOption("short")
    expect(params(page).get("page")).toBe("2")
    expect(params(page).getAll("tag")).toEqual([])
    await dialog.getByRole("button", { name: "Apply filters" }).click()
    await expect(dialog).not.toBeVisible()
    expect(params(page).getAll("tag")).toEqual(["react", "typescript"])
    expect(params(page).get("sort")).toBe("oldest")
    await expect(page.locator("[data-active-filters]")).toBeVisible()
    expect(params(page).get("date")).toBe("30d")
    expect(params(page).get("duration")).toBe("short")
    expect(params(page).get("page")).toBeNull()
    const next = page.locator('nav[aria-label="Writing pages"] a[rel="next"]')
    await next.click()
    await expect(page.getByRole("link", { name: "Archive fixture 2" })).toBeVisible()
    expect(params(page).get("page")).toBe("2")
    expect(params(page).getAll("tag")).toEqual(["react", "typescript"])
    expect(params(page).get("q")).toBe("renderer")
    await page.getByRole("searchbox", { name: /search articles/i }).fill("database")
    await page.getByRole("button", { name: "Search", exact: true }).click()
    await expect(page.getByRole("link", { name: "Archive fixture 1" })).toBeVisible()
    expect(params(page).get("q")).toBe("database")
    expect(params(page).get("page")).toBeNull()
    expect(params(page).get("duration")).toBe("short")
    expect(params(page).getAll("tag")).toEqual(["react", "typescript"])
  })

  test("Escape discards pending changes and restores focus; back restores applied state", async ({
    page,
  }) => {
    await page.goto("/writing")
    let dialog = await openFilters(page)
    await dialog.getByRole("button", { name: /TypeScript.*12/i }).click()
    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press("Tab")
      await expect
        .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
        .toBe(true)
    }
    await page.keyboard.press("Escape")
    await expect(dialog).not.toBeVisible()
    await expect(page.getByRole("button", { name: "Filters and sort" })).toBeFocused()
    dialog = await openFilters(page)
    await expect(dialog.getByRole("button", { name: /TypeScript.*12/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
    await dialog.getByRole("button", { name: /TypeScript.*12/i }).click()
    await dialog.getByRole("button", { name: "Apply filters" }).click()
    await expect(page).toHaveURL(/tag=typescript/)
    await page.goBack()
    await expect(page).toHaveURL(/\/writing$/)
    dialog = await openFilters(page)
    await expect(dialog.getByRole("button", { name: /TypeScript.*12/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    )
  })

  test("clear filters keeps the search term and resets pagination and sort", async ({ page }) => {
    await page.goto("/writing?q=renderer&tag=react&sort=oldest&date=30d&duration=short&page=2")
    const dialog = await openFilters(page)
    await dialog.getByRole("button", { name: "Clear filters" }).click()
    await expect(page).toHaveURL(/\/writing\?q=renderer$/)
    expect(params(page).getAll("tag")).toEqual([])
    expect(params(page).get("page")).toBeNull()
    expect(params(page).get("sort")).toBeNull()
    await expect(page.locator("[data-active-filters]")).toHaveCount(0)
  })

  test("offers all sorts and requires a query for relevance", async ({ page }) => {
    await page.goto("/writing")
    const dialog = await openFilters(page)
    const select = dialog.getByLabel("Sort by", { exact: true })
    await expect(select.locator("option")).toHaveText([
      "Newest",
      "Oldest",
      "Most viewed",
      "Recently updated",
      "Most Relevant (search first to enable)",
      "Title A-Z",
      "Title Z-A",
    ])
    await expect(select.locator('option[value="relevance"]')).toHaveAttribute("disabled", "")
    await page.keyboard.press("Escape")
    await page.goto("/writing?q=renderer")
    const searched = await openFilters(page)
    await expect(
      searched.getByLabel("Sort by", { exact: true }).locator('option[value="relevance"]')
    ).not.toHaveAttribute("disabled", "")
  })

  test("explains each sort and restores its caption after Apply and back", async ({ page }) => {
    await page.goto("/writing?q=renderer")
    let dialog = await openFilters(page)
    await expect(
      dialog.getByText("Latest published articles first.", { exact: true })
    ).toBeVisible()
    for (const [sort, description] of [
      ["oldest", "Earliest published articles first."],
      ["views", "Articles with the most views first."],
      ["updated", "Most recently updated articles first."],
      ["relevance", "Best matches for your search first."],
      ["title-asc", "Article titles in alphabetical order, A to Z."],
      ["title-desc", "Article titles in reverse alphabetical order, Z to A."],
    ]) {
      await dialog.getByLabel("Sort by", { exact: true }).selectOption(sort)
      await expect(dialog.getByText(description, { exact: true })).toBeVisible()
    }
    await dialog.getByLabel("Sort by", { exact: true }).selectOption("oldest")
    await dialog.getByRole("button", { name: "Apply filters" }).click()
    await expect(page).toHaveURL(/sort=oldest/)
    dialog = await openFilters(page)
    await expect(dialog.getByLabel("Sort by", { exact: true })).toHaveValue("oldest")
    await expect(
      dialog.getByText("Earliest published articles first.", { exact: true })
    ).toBeVisible()
    await page.keyboard.press("Escape")
    await page.goBack()
    await expect(page).toHaveURL(/\/writing\?q=renderer$/)
    dialog = await openFilters(page)
    await expect(dialog.getByLabel("Sort by", { exact: true })).toHaveValue("newest")
    await expect(
      dialog.getByText("Latest published articles first.", { exact: true })
    ).toBeVisible()
  })

  test("clears an applied query while preserving filters and keeps input focus", async ({
    page,
  }) => {
    await page.goto("/writing?q=renderer&tag=react&sort=oldest&duration=short&page=2")
    await expect(page.getByRole("link", { name: "Archive fixture 2" })).toBeVisible()
    await page.getByRole("button", { name: "Clear search", exact: true }).click()
    await expect(page).not.toHaveURL(/q=|page=/)
    expect(params(page).get("tag")).toBe("react")
    expect(params(page).get("sort")).toBe("oldest")
    expect(params(page).get("duration")).toBe("short")
    const input = page.getByRole("searchbox", { name: "Search articles", exact: true })
    await expect(input).toHaveValue("")
    await expect(input).toBeFocused()
    await input.fill("unsent query")
    const before = page.url()
    await page.getByRole("button", { name: "Clear search", exact: true }).click()
    expect(page.url()).toBe(before)
    await expect(input).toHaveValue("")
    await expect(input).toBeFocused()
  })

  test("validates reversed custom dates before applying, then shares an inclusive range", async ({
    page,
  }) => {
    await page.goto("/writing")
    const dialog = await openFilters(page)
    await dialog.getByLabel("Publication date", { exact: true }).selectOption("custom")
    await dialog.getByLabel("From", { exact: true }).fill("2026-10-09")
    await dialog.getByLabel("To", { exact: true }).fill("2026-10-01")
    await dialog.getByRole("button", { name: "Apply filters" }).click()
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole("alert")).toContainText("start on or before the end")
    expect(params(page).get("date")).toBeNull()
    await dialog.getByLabel("To", { exact: true }).fill("2026-10-09")
    await dialog.getByRole("button", { name: "Apply filters" }).click()
    await expect(dialog).not.toBeVisible()
    expect(params(page).get("from")).toBe("2026-10-09")
    expect(params(page).get("to")).toBe("2026-10-09")
  })

  test("keeps search controls separated from the empty state with combined filters", async ({
    page,
  }) => {
    await page.goto("/writing?q=nothing&tag=react&duration=long")
    const empty = page.getByText(/nothing matches/i)
    await expect(empty).toBeVisible()
    const search = await page.getByRole("search").boundingBox()
    const result = await empty.boundingBox()
    expect(result!.y).toBeGreaterThan(search!.y + search!.height + 16)
    await expect(page.getByRole("button", { name: "Filters and sort" })).toBeVisible()
  })

  test("aligns search and filter controls on desktop and mobile", async ({ page }) => {
    for (const width of [375, 1232]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto("/writing?tag=react")
      await expect(page.getByRole("status").filter({ hasText: /articles?/ })).toBeVisible()
      const input = await page.getByRole("searchbox", { name: /search articles/i }).boundingBox()
      const search = await page.getByRole("button", { name: "Search", exact: true }).boundingBox()
      const filter = await page.getByRole("button", { name: "Filters and sort" }).boundingBox()
      for (const control of [input!, search!, filter!]) {
        expect(control.height).toBe(44)
        expect(control.y).toBe(input!.y)
      }
      const dot = page.locator("[data-active-filters]")
      await expect(dot).toBeVisible()
      const colors = await dot.evaluate((element) => {
        const probe = document.createElement("span")
        probe.style.backgroundColor = "var(--primitive-brand-500)"
        document.body.appendChild(probe)
        const expected = window.getComputedStyle(probe).backgroundColor
        const actual = window.getComputedStyle(element).backgroundColor
        probe.remove()
        return { actual, expected }
      })
      expect(colors.actual).toBe(colors.expected)
    }
  })

  test("keeps the sheet and search within a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/writing")
    const dialog = await openFilters(page)
    await expect(dialog.getByRole("button", { name: "Apply filters" })).toBeVisible()
    await expect
      .poll(async () => {
        const bounds = await dialog.boundingBox()
        return bounds!.x + bounds!.width
      })
      .toBeLessThanOrEqual(375)
    const bounds = await dialog.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    await dialog.getByRole("button", { name: /React.*5/i }).click()
    await dialog.getByRole("button", { name: "Apply filters" }).click()
    await expect(page).toHaveURL(/tag=react/)
  })
})
