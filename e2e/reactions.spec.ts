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

const controls = (page: Page) => page.getByRole("group", { name: "Reaction controls", exact: true })
const summary = (page: Page) => page.getByRole("region", { name: "Reader reactions", exact: true })
const picker = (page: Page) => page.getByRole("dialog", { name: "Choose a reaction", exact: true })

async function chooseReaction(page: Page, label: string) {
  await controls(page).getByRole("button", { name: "Add reaction", exact: true }).click()
  await picker(page).getByRole("button", { name: label, exact: true }).click()
  await expect(picker(page)).toHaveCount(0)
}

test.describe("public reader reactions", () => {
  test.skip(
    !process.env.DATABASE_URL,
    "needs seeded public article HTML; reaction APIs are isolated browser fixtures"
  )

  test("hides empty counts and adds independent emoji through a keyboard picker without refetching", async ({
    page,
  }) => {
    const requests: string[] = []
    page.on("request", (request) => {
      if (request.method() === "GET" && request.url().endsWith("/reactions"))
        requests.push(request.url())
    })
    const writes = await mockReactions(page)
    await page.goto(`/writing/${SEEDED_POST_SLUG}`)
    const trigger = controls(page).getByRole("button", { name: "Add reaction", exact: true })
    await expect(trigger).toBeEnabled()
    await expect(summary(page)).toHaveCount(0)
    expect(await page.evaluate((key) => localStorage.getItem(key), REACTION_VISITOR_KEY)).toBeNull()
    await trigger.focus()
    await page.keyboard.press("Space")
    await expect(picker(page).getByRole("button")).toHaveCount(5)
    const love = picker(page).getByRole("button", { name: "Love", exact: true })
    await love.focus()
    await page.keyboard.press("Space")
    await expect(picker(page)).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect(
      summary(page).getByRole("button", { name: "Love: 1 reaction", exact: true })
    ).toHaveAttribute("aria-pressed", "true")
    await chooseReaction(page, "Rocket")
    await expect(
      summary(page).getByRole("button", { name: "Rocket: 1 reaction", exact: true })
    ).toHaveAttribute("aria-pressed", "true")
    await expect(summary(page).getByRole("button")).toHaveCount(2)
    expect(writes).toHaveLength(2)
    expect(requests).toHaveLength(1)
    await page.reload()
    await expect(
      summary(page).getByRole("button", { name: "Love: 1 reaction", exact: true })
    ).toHaveAttribute("aria-pressed", "true")
    await expect(
      summary(page).getByRole("button", { name: "Rocket: 1 reaction", exact: true })
    ).toHaveAttribute("aria-pressed", "true")
    await summary(page).getByRole("button", { name: "Love: 1 reaction", exact: true }).click()
    await expect(summary(page).getByRole("button", { name: /Love:/ })).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await expect(controls(page).getByRole("status")).toHaveText("Love reaction removed.")
  })

  test("dismisses the picker with Escape without creating identity or writing", async ({
    page,
  }) => {
    const writes = await mockReactions(page)
    await page.goto(`/writing/${SEEDED_POST_SLUG}`)
    const trigger = controls(page).getByRole("button", { name: "Add reaction", exact: true })
    await expect(trigger).toBeEnabled()
    await trigger.click()
    await expect(picker(page)).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(picker(page)).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(writes).toHaveLength(0)
    expect(await page.evaluate((key) => localStorage.getItem(key), REACTION_VISITOR_KEY)).toBeNull()
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
      const put = page.waitForRequest(
        (request) => request.method() === "PUT" && request.url().endsWith("/reactions")
      )
      await chooseReaction(page, "Love")
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
        summary(page).getByRole("button", { name: "Love: 1 reaction", exact: true })
      ).toHaveAttribute("aria-pressed", "false")
      expect(await page.evaluate((key) => localStorage.getItem(key), REACTION_VISITOR_KEY)).toBe(
        replacement
      )
    })
  }

  test("recovers a failed load and announces failed mutations without invented counts", async ({
    page,
  }) => {
    await mockReactions(page)
    await page.route(
      "**/api/writing/posts/*/reactions",
      (route) => route.fulfill({ status: 503, json: { message: "Unavailable" } }),
      { times: 1 }
    )
    await page.goto(`/writing/${SEEDED_POST_SLUG}`)
    await expect(controls(page).getByRole("status")).toHaveText("Reactions could not be loaded.")
    await expect(
      controls(page).getByRole("button", { name: "Add reaction", exact: true })
    ).toBeDisabled()
    await expect(summary(page).getByRole("button", { name: /Love/ })).toHaveCount(0)
    await summary(page).getByRole("button", { name: "Try loading reactions again" }).click()
    await expect(
      controls(page).getByRole("button", { name: "Add reaction", exact: true })
    ).toBeEnabled()
    await expect(summary(page)).toHaveCount(0)
    await page.route("**/api/writing/posts/*/reactions", (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({ status: 429, json: { message: "Too many requests" } })
        : route.fallback()
    )
    await chooseReaction(page, "Love")
    await expect(controls(page).getByRole("status")).toHaveText(
      "Your reaction could not be saved. Please try again."
    )
    await expect(summary(page).getByRole("button", { name: /Love/ })).toHaveCount(0)
    await expect(
      controls(page).getByRole("button", { name: "Add reaction", exact: true })
    ).toBeEnabled()
  })

  test("announces blocked functional storage without submitting a write", async ({ page }) => {
    const writes = await mockReactions(page)
    await page.addInitScript((key) => {
      const original = Storage.prototype.setItem
      Storage.prototype.setItem = function (name, value) {
        if (name === key) throw new Error("Blocked storage")
        return original.call(this, name, value)
      }
    }, REACTION_VISITOR_KEY)
    await page.goto(`/writing/${SEEDED_POST_SLUG}`)
    await chooseReaction(page, "Love")
    await expect(controls(page).getByRole("status")).toHaveText(
      "Allow site storage to save your reaction, then try again."
    )
    expect(writes).toHaveLength(0)
    await expect(summary(page).getByRole("button")).toHaveCount(0)
  })

  test("places counted reactions between metadata and tags with a balanced accessible mobile picker", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockReactions(page)
    await page.goto(`/writing/${SEEDED_POST_SLUG}`)
    await chooseReaction(page, "Love")
    const chip = summary(page).getByRole("button", { name: "Love: 1 reaction", exact: true })
    await expect(chip).toBeVisible()
    const tags = page.getByRole("navigation", { name: "Article tags", exact: true })
    const add = await controls(page)
      .getByRole("button", { name: "Add reaction", exact: true })
      .boundingBox()
    const share = await page
      .getByRole("button", { name: "Copy article link", exact: true })
      .boundingBox()
    await expect(chip).toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
    await expect(chip).toHaveCSS("border-top-width", "0px")
    await expect(chip.locator("span").last()).toHaveCSS("font-size", "12px")
    const gaps = await page.locator("article h1").evaluate((heading) => {
      const rows = [...heading.parentElement!.children]
        .map((row) => row.getBoundingClientRect())
        .filter((row) => row.height > 0)
      return rows.slice(1).map((row, index) => row.top - rows[index].bottom)
    })
    for (const gap of gaps) expect(gap).toBeCloseTo(12, 0)
    const reactionBounds = await summary(page).boundingBox()
    const tagBounds = await tags.boundingBox()
    expect(add!.x).toBeLessThan(share!.x)
    expect(reactionBounds!.y).toBeGreaterThanOrEqual(add!.y + add!.height)
    expect(reactionBounds!.y + reactionBounds!.height).toBeLessThanOrEqual(tagBounds!.y)
    expect(
      await chip
        .locator("span")
        .first()
        .evaluate((node) => getComputedStyle(node).fontSize)
    ).toBe("14px")
    await controls(page).getByRole("button", { name: "Add reaction", exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    const results = await new AxeBuilder({ page }).include('div[role="dialog"]').analyze()
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
  await expect(page.getByRole("button", { name: "Add reaction", exact: true })).toHaveCount(0)
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
