import { expect, test, type Page } from "@playwright/test"

declare global {
  interface Window {
    paginationScrollCalls?: ScrollToOptions[]
  }
}

async function setup(page: Page, admin: boolean) {
  await page.context().addCookies([
    {
      name: "better-auth.session_token",
      value: "fixture",
      url: test.info().project.use.baseURL as string,
    },
  ])
  await page.addInitScript(() => {
    const calls: ScrollToOptions[] = []
    Object.assign(window, { paginationScrollCalls: calls })
    const original = window.scrollTo.bind(window)
    window.scrollTo = ((first?: ScrollToOptions | number, second?: number) => {
      if (typeof first === "object" && first) calls.push(first)
      if (typeof first === "number") original(first, second ?? 0)
      else original(first)
    }) as typeof window.scrollTo
  })
  const prefix = admin ? "/api/admin/" : "/api/writing/"
  let release!: () => void
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(`**${prefix}**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith("/session"))
      return route.fulfill({
        json: {
          author: { id: "fixture", name: "Author", email: "author@example.test" },
          authConfigured: true,
          databaseConfigured: true,
          coverUploadsConfigured: false,
          previewConfigured: true,
        },
      })
    if (url.pathname.endsWith("/tags")) return route.fulfill({ json: [] })
    const number = Number(url.searchParams.get("page") ?? "1")
    if (number === 2) await waiting
    const posts = Array.from({ length: 10 }, (_, index) => ({
      id: `${number}-${index}`,
      slug: `page-${number}-post-${index}`,
      title: `Page ${number} post ${index}`,
      excerpt: "A paginated result with enough content to verify scrolling.",
      status: "draft",
      publishedAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      readingTime: 1,
      coverUrl: null,
      coverAlt: null,
      tags: [],
    }))
    await route.fulfill({ json: { posts, total: 30, page: number, pageCount: 3 } })
  })
  return release
}

for (const admin of [false, true]) {
  for (const reducedMotion of ["reduce", "no-preference"] as const) {
    test(`${admin ? "admin" : "public"} pagination waits for results, focuses their top and honors ${reducedMotion}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion })
      const release = await setup(page, admin)
      await page.goto(`${admin ? "/admin/posts" : "/writing"}?q=fixture&sort=oldest`)
      await expect(
        page.getByRole("link", { name: "Page 1 post 0", exact: true }).first()
      ).toBeVisible()
      const results = page.locator("[data-pagination-results]")
      await page.getByRole("link", { name: "Next", exact: true }).click()
      await expect(page).toHaveURL(/page=2/)
      await expect(results).not.toBeFocused()
      release()
      await expect(
        page.getByRole("link", { name: "Page 2 post 0", exact: true }).first()
      ).toBeVisible()
      await expect(results).toBeFocused()
      await expect(results).toHaveAccessibleName(`${admin ? "Posts" : "Writing"} results, page 2`)
      await expect
        .poll(() =>
          page.evaluate(() => {
            return window.paginationScrollCalls?.at(-1)?.behavior
          })
        )
        .toBe(reducedMotion === "reduce" ? "instant" : "smooth")
      await expect.poll(async () => (await results.boundingBox())?.y).toBeGreaterThanOrEqual(0)
      await expect.poll(async () => (await results.boundingBox())?.y).toBeLessThan(350)
      expect(new URL(page.url()).searchParams.get("q")).toBe("fixture")
      await page.getByRole("link", { name: "Previous", exact: true }).click()
      await expect(
        page.getByRole("link", { name: "Page 1 post 0", exact: true }).first()
      ).toBeVisible()
      await expect(results).toBeFocused()
      await expect(results).toHaveAccessibleName(`${admin ? "Posts" : "Writing"} results, page 1`)
    })
  }
}

test("does not steal focus when the reader chooses search during a pending page", async ({
  page,
}) => {
  const release = await setup(page, false)
  await page.goto("/writing?q=fixture")
  await expect(page.getByRole("link", { name: "Page 1 post 0", exact: true })).toBeVisible()
  await page.getByRole("link", { name: "Next", exact: true }).click()
  await expect(page).toHaveURL(/page=2/)
  const search = page.getByRole("searchbox", { name: "Search articles", exact: true })
  await search.focus()
  release()
  await expect(page.getByRole("link", { name: "Page 2 post 0", exact: true })).toBeVisible()
  await expect(search).toBeFocused()
})
