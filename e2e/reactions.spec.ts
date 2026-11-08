import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"
import { E2E_BASE_URL, SEEDED_POST_SLUG } from "./support/constants"
import { REACTIONS, REACTION_VISITOR_KEY, type Reaction } from "../features/writing/reactions"

async function mockReactions(page: Page, beforeWrite?: () => Promise<void>) {
  const visitors = new Map<string, Set<Reaction>>()
  const writes: unknown[] = []
  await page.route("**/api/writing/posts/*/reactions", async (route) => {
    const request = route.request()
    let visitorId = request.headers()["x-reaction-visitor"]
    if (request.method() === "PUT") {
      await beforeWrite?.()
      const body = request.postDataJSON()
      writes.push(body)
      visitorId = body.visitorId
      const selected = visitors.get(visitorId) ?? new Set<Reaction>()
      if (body.active) selected.add(body.reaction)
      else selected.delete(body.reaction)
      visitors.set(visitorId, selected)
    }
    const counts = Object.fromEntries(
      REACTIONS.map((reaction) => [
        reaction,
        [...visitors.values()].filter((selected) => selected.has(reaction)).length,
      ])
    )
    await route.fulfill({ json: { counts, selected: [...(visitors.get(visitorId) ?? [])] } })
  })
  return writes
}

test.describe("public reader reactions", () => {
  test.skip(
    !process.env.DATABASE_URL,
    "needs seeded public article HTML; reaction APIs are isolated browser fixtures"
  )

  test("creates identity on first keyboard reaction and persists independent emoji across reload", async ({
    page,
  }) => {
    const writes = await mockReactions(page)
    await page.goto(`/writing/${SEEDED_POST_SLUG}`)
    const bar = page.getByRole("region", { name: "Reader reactions" })
    const love = bar.getByRole("button", { name: "Love: 0 reactions", exact: true })
    await expect(love).toBeEnabled()
    expect(await page.evaluate((key) => localStorage.getItem(key), REACTION_VISITOR_KEY)).toBeNull()
    await love.focus()
    await page.keyboard.press("Space")
    await expect(
      bar.getByRole("button", { name: "Love: 1 reactions", exact: true })
    ).toHaveAttribute("aria-pressed", "true")
    await bar.getByRole("button", { name: "Rocket: 0 reactions", exact: true }).click()
    await expect(
      bar.getByRole("button", { name: "Rocket: 1 reactions", exact: true })
    ).toHaveAttribute("aria-pressed", "true")
    expect(writes).toHaveLength(2)
    await page.reload()
    await expect(
      bar.getByRole("button", { name: "Love: 1 reactions", exact: true })
    ).toHaveAttribute("aria-pressed", "true")
    await expect(
      bar.getByRole("button", { name: "Rocket: 1 reactions", exact: true })
    ).toHaveAttribute("aria-pressed", "true")
    await bar.getByRole("button", { name: "Love: 1 reactions", exact: true }).click()
    await expect(
      bar.getByRole("button", { name: "Love: 0 reactions", exact: true })
    ).toHaveAttribute("aria-pressed", "false")
    await expect(bar.getByRole("status")).toHaveText("Love reaction removed.")
  })

  for (const replacement of [null, "550e8400-e29b-41d4-a716-446655440000"]) {
    test(`does not restore an identity ${replacement ? "replaced" : "cleared"} during a pending reaction`, async ({
      page,
    }) => {
      let release!: () => void
      const waiting = new Promise<void>((resolve) => {
        release = resolve
      })
      await mockReactions(page, () => waiting)
      await page.goto(`/writing/${SEEDED_POST_SLUG}`)
      const bar = page.getByRole("region", { name: "Reader reactions" })
      const put = page.waitForRequest(
        (request) => request.method() === "PUT" && request.url().endsWith("/reactions")
      )
      await bar.getByRole("button", { name: "Love: 0 reactions", exact: true }).click()
      await put
      await page.evaluate(
        ({ key, replacement }) => {
          if (replacement) localStorage.setItem(key, replacement)
          else localStorage.removeItem(key)
          window.dispatchEvent(new StorageEvent("storage", { key, newValue: replacement }))
        },
        { key: REACTION_VISITOR_KEY, replacement }
      )
      release()
      await expect(
        bar.getByRole("button", { name: "Love: 1 reactions", exact: true })
      ).toHaveAttribute("aria-pressed", "false")
      expect(await page.evaluate((key) => localStorage.getItem(key), REACTION_VISITOR_KEY)).toBe(
        replacement
      )
    })
  }

  test("recovers a failed load without invented counts and retains counts after a failed mutation", async ({
    page,
  }) => {
    await mockReactions(page)
    await page.route(
      "**/api/writing/posts/*/reactions",
      (route) => route.fulfill({ status: 503, json: { message: "Unavailable" } }),
      { times: 1 }
    )
    await page.goto(`/writing/${SEEDED_POST_SLUG}`)
    const bar = page.getByRole("region", { name: "Reader reactions" })
    await expect(bar.getByRole("status")).toHaveText("Reactions could not be loaded.")
    await expect(bar.getByRole("button", { name: "Love: count unavailable" })).toBeDisabled()
    await bar.getByRole("button", { name: "Try loading reactions again" }).click()
    const love = bar.getByRole("button", { name: "Love: 0 reactions", exact: true })
    await expect(love).toBeEnabled()
    await page.route("**/api/writing/posts/*/reactions", (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({ status: 429, json: { message: "Too many requests" } })
        : route.fallback()
    )
    await love.click()
    await expect(bar.getByRole("status")).toHaveText(
      "Your reaction could not be saved. Please try again."
    )
    await expect(love).toHaveAttribute("aria-pressed", "false")
    await expect(love).toBeEnabled()
  })

  test("announces blocked functional storage and does not submit a write", async ({ page }) => {
    const writes = await mockReactions(page)
    await page.addInitScript((key) => {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function (name, value) {
        if (name === key) throw new Error("Blocked storage")
        return original.call(this, name, value)
      }
    }, REACTION_VISITOR_KEY)
    await page.goto(`/writing/${SEEDED_POST_SLUG}`)
    const bar = page.getByRole("region", { name: "Reader reactions" })
    await bar.getByRole("button", { name: "Love: 0 reactions", exact: true }).click()
    await expect(bar.getByRole("status")).toHaveText(
      "Allow site storage to save your reaction, then try again."
    )
    expect(writes).toHaveLength(0)
  })

  test("wraps on mobile with accessible names and pressed states", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockReactions(page)
    await page.goto(`/writing/${SEEDED_POST_SLUG}`)
    const bar = page.getByRole("region", { name: "Reader reactions" })
    await expect(bar.getByRole("button", { name: "Love: 0 reactions", exact: true })).toBeEnabled()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    const results = await new AxeBuilder({ page })
      .include('section[aria-label="Reader reactions"]')
      .analyze()
    expect(results.violations).toEqual([])
  })
})

test("signed previews expose no reaction controls or requests", async ({ page }) => {
  const requests: string[] = []
  page.on("request", (request) => {
    if (request.url().includes("/reactions")) requests.push(request.url())
  })
  await page.route("**/api/writing/preview/reaction-fixture?**", (route) =>
    route.fulfill({
      json: {
        post: {
          id: "fixture",
          slug: "reaction-fixture",
          title: "Private reaction fixture",
          status: "draft",
          publishedAt: null,
          updatedAt: "2026-11-08T00:00:00Z",
          readingTime: 1,
          tags: [],
          seriesContext: null,
        },
        article: { headings: [], html: "<p>Private article body.</p>" },
      },
    })
  )
  await page.goto("/writing/reaction-fixture/preview?token=browser-fixture")
  await expect(page.getByRole("heading", { name: "Private reaction fixture" })).toBeVisible()
  await expect(page.getByRole("region", { name: "Reader reactions" })).toHaveCount(0)
  expect(requests).toEqual([])
})

test("persists idempotent reactions through the real Worker API", async ({ request }) => {
  test.skip(!process.env.DATABASE_URL, "needs disposable seeded database")
  const path = `/api/writing/posts/${SEEDED_POST_SLUG}/reactions`
  const visitorId = crypto.randomUUID()
  const headers = { origin: E2E_BASE_URL, "x-reaction-visitor": visitorId }
  const before = await request.get(path, { headers })
  expect(before.ok()).toBe(true)
  const initial = await before.json()
  const data = { visitorId, reaction: "noted", active: true }
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const added = await request.put(path, { headers, data })
      expect(added.ok()).toBe(true)
      expect(await added.json()).toMatchObject({
        counts: { noted: initial.counts.noted + 1 },
        selected: ["noted"],
      })
    }
    const read = await request.get(path, { headers })
    expect(await read.json()).toMatchObject({ selected: ["noted"] })
  } finally {
    const removed = await request.put(path, { headers, data: { ...data, active: false } })
    expect(removed.ok()).toBe(true)
    expect(await removed.json()).toMatchObject({
      counts: { noted: initial.counts.noted },
      selected: [],
    })
  }
})
