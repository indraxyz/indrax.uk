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

const summary = (page: Page) => page.locator('[data-reaction-location="header"]')
const controls = (page: Page) =>
  summary(page).getByRole("group", { name: "Reaction controls", exact: true })
const chips = (page: Page) => summary(page).locator("button[aria-pressed]")
const status = (page: Page) => page.getByRole("status")
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
    await expect(chips(page)).toHaveCount(0)
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
    await expect(chips(page)).toHaveCount(2)
    await trigger.click()
    const selectedLove = picker(page).getByRole("button", { name: "Love", exact: true })
    await expect(selectedLove).toHaveAttribute("aria-pressed", "true")
    await page.keyboard.press("Escape")
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
    await expect(status(page)).toHaveText("Love reaction removed.")
  })

  test("dismisses the picker with Escape without creating identity or writing", async ({
    page,
  }) => {
    const writes = await mockReactions(page)
    await page.goto(`/writing/${SEEDED_POST_SLUG}`)
    const trigger = controls(page).getByRole("button", { name: "Add reaction", exact: true })
    await expect(trigger).toBeEnabled()
    await trigger.click()
    await expect(picker(page)).toHaveCount(1)
    const popupId = await picker(page).getAttribute("id")
    expect(popupId).toBeTruthy()
    await expect(trigger).toHaveAttribute("aria-controls", popupId!)
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
    await expect(status(page)).toHaveText("Reactions could not be loaded.")
    await expect(
      controls(page).getByRole("button", { name: "Add reaction", exact: true })
    ).toBeDisabled()
    await expect(summary(page).getByRole("button", { name: /Love/ })).toHaveCount(0)
    await summary(page).getByRole("button", { name: "Try loading reactions again" }).click()
    await expect(
      controls(page).getByRole("button", { name: "Add reaction", exact: true })
    ).toBeEnabled()
    await expect(chips(page)).toHaveCount(0)
    await page.route("**/api/writing/posts/*/reactions", (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({ status: 429, json: { message: "Too many requests" } })
        : route.fallback()
    )
    await chooseReaction(page, "Love")
    await expect(status(page)).toHaveText("Your reaction could not be saved. Please try again.")
    await expect(
      summary(page).getByText("Your reaction could not be saved. Please try again.", {
        exact: true,
      })
    ).toBeVisible()
    await expect(summary(page).getByRole("button", { name: /Love/ })).toHaveCount(0)
    await expect(
      controls(page).getByRole("button", { name: "Add reaction", exact: true })
    ).toBeEnabled()
  })

  test("announces a new visitor load failure after an earlier successful reaction", async ({
    page,
  }) => {
    await mockReactions(page)
    await page.goto(`/writing/${SEEDED_POST_SLUG}`)
    await chooseReaction(page, "Love")
    await expect(status(page)).toHaveText("Love reaction added.")
    await page.route(
      "**/api/writing/posts/*/reactions",
      (route) => route.fulfill({ status: 503, json: { message: "Unavailable" } }),
      { times: 1 }
    )
    await page.evaluate((key) => {
      const visitorId = "550e8400-e29b-41d4-a716-446655440000"
      localStorage.setItem(key, visitorId)
      window.dispatchEvent(new StorageEvent("storage", { key, newValue: visitorId }))
    }, REACTION_VISITOR_KEY)
    await expect(status(page)).toHaveCount(1)
    await expect(status(page)).toHaveText("Reactions could not be loaded.")
    await expect(
      summary(page).getByText("Reactions could not be loaded.", { exact: true })
    ).toBeVisible()
    await expect(
      summary(page).getByRole("button", {
        name: "Try loading reactions again",
        exact: true,
      })
    ).toBeEnabled()
    await summary(page)
      .getByRole("button", { name: "Try loading reactions again", exact: true })
      .click()
    await expect(
      controls(page).getByRole("button", { name: "Add reaction", exact: true })
    ).toBeEnabled()
    await expect(
      summary(page).getByRole("button", { name: "Love: 1 reaction", exact: true })
    ).toHaveAttribute("aria-pressed", "false")
    await expect(
      summary(page).getByRole("button", {
        name: "Try loading reactions again",
        exact: true,
      })
    ).toHaveCount(0)
    await expect(status(page)).toHaveText("")
  })

  test("keeps the server-rendered article readable with JavaScript disabled", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL: E2E_BASE_URL })
    try {
      const page = await context.newPage()
      const reactionRequests: string[] = []
      page.on("request", (request) => {
        if (request.url().includes("/reactions")) reactionRequests.push(request.url())
      })
      const response = await page.goto(`/writing/${SEEDED_POST_SLUG}`)
      expect(response?.ok()).toBe(true)
      await expect(page.locator("article h1")).toBeVisible()
      await expect(page.locator("article .prose")).toBeVisible()
      expect((await page.locator("article .prose").innerText()).trim().length).toBeGreaterThan(100)
      await expect(
        controls(page).getByRole("button", { name: "Add reaction", exact: true })
      ).toBeDisabled()
      await expect(chips(page)).toHaveCount(0)
      expect(reactionRequests).toEqual([])
    } finally {
      await context.close()
    }
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
    await expect(status(page)).toHaveText(
      "Allow site storage to save your reaction, then try again."
    )
    expect(writes).toHaveLength(0)
    await expect(chips(page)).toHaveCount(0)
  })

  test("guards pending submissions and seeds counts without another read", async ({ page }) => {
    let release!: () => void
    let hold = false
    const waiting = new Promise<void>((resolve) => {
      release = resolve
    })
    const reads: string[] = []
    page.on("request", (request) => {
      if (request.method() === "GET" && request.url().endsWith("/reactions"))
        reads.push(request.url())
    })
    const writes = await mockReactions(page, () => (hold ? waiting : Promise.resolve()))
    await page.goto(`/writing/${SEEDED_POST_SLUG}`)
    await chooseReaction(page, "Love")
    await expect(summary(page).getByRole("button", { name: "Love: 1 reaction" })).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    hold = true
    const put = page.waitForRequest(
      (request) => request.method() === "PUT" && request.url().endsWith("/reactions")
    )
    await summary(page).getByRole("button", { name: "Love: 1 reaction" }).click()
    await put
    await expect(chips(page)).toBeDisabled()
    const trigger = controls(page).getByRole("button", { name: "Add reaction", exact: true })
    await trigger.click()
    await expect(picker(page).getByRole("button")).toHaveCount(5)
    for (const button of await picker(page).getByRole("button").all())
      await expect(button).toBeDisabled()
    await page.keyboard.press("Escape")
    release()
    await expect(chips(page)).toHaveCount(0)
    expect(writes).toHaveLength(2)
    expect(reads).toHaveLength(1)
    await expect(status(page)).toHaveCount(1)
    await expect(status(page)).toHaveText("Love reaction removed.")
  })

  test("keeps focus that moved away while removing the final chip", async ({ page }) => {
    let release!: () => void
    let hold = false
    const waiting = new Promise<void>((resolve) => {
      release = resolve
    })
    await mockReactions(page, () => (hold ? waiting : Promise.resolve()))
    await page.goto(`/writing/${SEEDED_POST_SLUG}`)
    await chooseReaction(page, "Love")
    hold = true
    const put = page.waitForRequest(
      (request) => request.method() === "PUT" && request.url().endsWith("/reactions")
    )
    await summary(page).getByRole("button", { name: "Love: 1 reaction" }).click()
    await put
    const copy = page.getByRole("button", { name: "Copy article link", exact: true })
    await copy.focus()
    release()
    await expect(chips(page)).toHaveCount(0)
    await expect(copy).toBeFocused()
  })

  test("returns focus locally when the final chip disappears", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    let release!: () => void
    let hold = false
    const waiting = new Promise<void>((resolve) => {
      release = resolve
    })
    await mockReactions(page, () => (hold ? waiting : Promise.resolve()))
    await page.goto(`/writing/${SEEDED_POST_SLUG}`)
    await chooseReaction(page, "Love")
    const trigger = controls(page).getByRole("button", {
      name: "Add reaction",
      exact: true,
    })
    hold = true
    const put = page.waitForRequest(
      (request) => request.method() === "PUT" && request.url().endsWith("/reactions")
    )
    await summary(page).getByRole("button", { name: "Love: 1 reaction" }).click()
    await put
    await expect(chips(page)).toBeDisabled()
    let previousY: number | undefined
    await expect
      .poll(async () => {
        const nextY = await page.evaluate(() => window.scrollY)
        const stable = nextY === previousY
        previousY = nextY
        return stable
      })
      .toBe(true)
    const scrollY = await page.evaluate(() => window.scrollY)
    release()
    await expect(chips(page)).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollY)).toBeLessThan(2)
  })

  for (const { width, textSize, label } of [
    { width: 390, textSize: 200, label: "mobile 200% root text" },
    { width: 1280, textSize: 200, label: "desktop 200% root text" },
    { width: 320, textSize: 100, label: "320px reflow equivalent to 400% of 1280px" },
  ]) {
    test(`reflows long article details and large counts with ${label}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: "reduce" })
      await page.route("**/api/writing/posts/*/reactions", (route) =>
        route.fulfill({
          json: {
            counts: Object.fromEntries(REACTIONS.map((reaction) => [reaction, 123456])),
            selected: ["love", "rocket"],
          },
        })
      )
      await page.goto(`/writing/${SEEDED_POST_SLUG}`)
      await expect(chips(page)).toHaveCount(5)
      await page.locator("article h1").evaluate((heading) => {
        heading.textContent =
          "Building accessible article interactions with synchronized reactions and responsive reading controls across screen sizes"
      })
      await page
        .getByRole("navigation", { name: "Article tags", exact: true })
        .locator("a > div")
        .evaluateAll((tags) => {
          tags.forEach((tag, index) => {
            tag.textContent =
              index % 2
                ? "Responsive interface engineering and interaction design"
                : "Accessibility and practical browser testing"
          })
        })
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = `${size}%`
      }, textSize)
      const consent = page.getByRole("region", { name: "Analytics consent", exact: true })
      if (await consent.isVisible()) {
        for (const button of await consent.getByRole("button").all()) {
          const bounds = await button.boundingBox()
          expect(bounds!.x).toBeGreaterThanOrEqual(0)
          expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
        }
        // Exercise the wrapped consent action before inspecting the article
        // behind the enlarged fixed banner.
        await consent.getByRole("button", { name: "Decline", exact: true }).click()
        await expect(consent).toHaveCount(0)
      }
      const cardHeader = page.locator("article h1").locator("..")
      // This seed is updated at seeding time, so the passive row includes both dates.
      await expect(cardHeader.locator("time")).toHaveCount(2)
      const rows = await cardHeader.evaluate((header) =>
        [...header.children]
          .map((child) => {
            const { top, bottom } = child.getBoundingClientRect()
            return { top, bottom }
          })
          .filter((row) => row.bottom > row.top)
      )
      for (let index = 1; index < rows.length; index++)
        expect(rows[index].top).toBeGreaterThanOrEqual(rows[index - 1].bottom)
      await expect
        .poll(() => cardHeader.evaluate((header) => header.scrollWidth <= header.clientWidth))
        .toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      )
      const share = page.getByRole("button", { name: "Copy article link", exact: true })
      await expect(share).toHaveText("")
      await expect(share).toHaveAttribute("title", "Copy article link")
      const overlappingControls = await cardHeader.evaluate((header) => {
        const buttons = [
          ...header.querySelectorAll(
            '[data-reaction-location] button, button[aria-label="Copy article link"]'
          ),
        ].map((button) => button.getBoundingClientRect())
        return buttons.some((first, index) =>
          buttons
            .slice(index + 1)
            .some(
              (second) =>
                Math.min(first.right, second.right) - Math.max(first.left, second.left) > 0.5 &&
                Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > 0.5
            )
        )
      })
      expect(overlappingControls).toBe(false)
      await cardHeader.screenshot({
        path: test.info().outputPath(`reactions-stress-${width}-${textSize}.png`),
      })
      const trigger = controls(page).getByRole("button", {
        name: "Add reaction",
        exact: true,
      })
      await expect(trigger).toHaveText("")
      await expect(trigger).toHaveAttribute("title", "Add reaction")
      await trigger.click()
      await expect(picker(page)).toBeVisible()
      await expect(picker(page).getByRole("button")).toHaveCount(5)
      const bounds = await picker(page).boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
      for (const choice of await picker(page).getByRole("button").all()) {
        const target = await choice.boundingBox()
        expect(target!.width).toBeGreaterThanOrEqual(44)
        expect(target!.height).toBeGreaterThanOrEqual(44)
      }
      await page.evaluate(() => document.documentElement.classList.add("dark"))
      const results = await new AxeBuilder({ page })
        .include("[data-reaction-location]")
        .include('div[role="dialog"]')
        .analyze()
      expect(results.violations).toEqual([])
      await page.keyboard.press("Escape")
      await expect(picker(page)).toHaveCount(0)
      await expect(trigger).toBeFocused()
      await expect
        .poll(() => cardHeader.evaluate((header) => header.scrollWidth <= header.clientWidth))
        .toBe(true)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      )
    })
  }

  for (const width of [320, 390, 768, 1280]) {
    test(`keeps grouped reactions and icon controls usable at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.route("**/api/writing/posts/*/reactions", (route) =>
        route.fulfill({
          json: {
            counts: Object.fromEntries(REACTIONS.map((reaction) => [reaction, 123456])),
            selected: ["love"],
          },
        })
      )
      await page.goto(`/writing/${SEEDED_POST_SLUG}`)
      await expect(chips(page)).toHaveCount(5)
      const tags = page.getByRole("navigation", { name: "Article tags", exact: true })
      const header = summary(page)
      const share = page.getByRole("button", { name: "Copy article link", exact: true })
      await expect(share).toHaveAttribute("title", "Copy article link")
      const tagsBounds = await tags.boundingBox()
      const headerBounds = await header.boundingBox()
      expect(headerBounds!.y).toBeGreaterThanOrEqual(tagsBounds!.y + tagsBounds!.height)
      const metadata = page.locator("article time").first()
      expect((await metadata.boundingBox())!.y).toBeLessThan(tagsBounds!.y)
      const body = page.locator("article .prose")
      await expect(page.getByRole("region", { name: "Reader reactions", exact: true })).toHaveCount(
        1
      )
      await expect(
        page.locator("article").getByRole("region", { name: "Reader reactions", exact: true })
      ).toHaveCount(1)
      await expect(page.locator('[data-reaction-location="footer"]')).toHaveCount(0)
      expect(
        await body.evaluate((content) => {
          const reactions = document.querySelector('[data-reaction-location="header"]')!
          return Boolean(
            reactions.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING
          )
        })
      ).toBe(true)
      await expect(
        page.locator("article").getByRole("group", { name: "Reaction controls", exact: true })
      ).toHaveCount(1)
      expect(
        await page.locator("article").evaluate((article) => {
          const body = article.querySelector(".prose")!
          return [
            ...article.querySelectorAll('[role="group"][aria-label="Reaction controls"]'),
          ].every((group) =>
            Boolean(group.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING)
          )
        })
      ).toBe(true)
      for (const button of await controls(page).getByRole("button").all()) {
        const bounds = await button.boundingBox()
        expect(bounds!.height).toBeGreaterThanOrEqual(44)
        expect(bounds!.width).toBeGreaterThanOrEqual(44)
      }
      const shareBounds = await share.boundingBox()
      expect(shareBounds!.height).toBeGreaterThanOrEqual(44)
      expect(shareBounds!.width).toBeGreaterThanOrEqual(44)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width
      )
      const consent = page.getByRole("region", { name: "Analytics consent", exact: true })
      if (await consent.isVisible()) {
        await consent.getByRole("button", { name: "Decline", exact: true }).click()
        await expect(consent).toHaveCount(0)
      }
      await page
        .locator("article h1")
        .locator("..")
        .screenshot({
          path: test.info().outputPath(`reactions-header-${width}.png`),
        })
      await controls(page).getByRole("button", { name: "Add reaction", exact: true }).click()
      for (const button of await picker(page).getByRole("button").all()) {
        const bounds = await button.boundingBox()
        expect(bounds!.height).toBeGreaterThanOrEqual(44)
        expect(bounds!.width).toBeGreaterThanOrEqual(44)
      }
      const results = await new AxeBuilder({ page })
        .include("[data-reaction-location]")
        .include('div[role="dialog"]')
        .analyze()
      expect(results.violations).toEqual([])
      await page.keyboard.press("Escape")
      await page.emulateMedia({ media: "print" })
      await expect(header).toBeHidden()
      await expect(share).toBeHidden()
    })
  }
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
  await expect(page.getByRole("region", { name: /Reader reactions/ })).toHaveCount(0)
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

test("future-dated articles stay unavailable through SSR and the real reaction API", async ({
  request,
}) => {
  test.skip(!process.env.DATABASE_URL, "needs disposable seeded database")
  const url = new URL(process.env.DATABASE_URL!)
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Publication fixtures require a disposable loopback database.")
  const { neon, neonConfig } = await import("@neondatabase/serverless")
  neonConfig.fetchEndpoint = `http://${url.hostname}:${url.port || "4444"}/sql`
  const sql = neon(url.toString())
  const id = crypto.randomUUID()
  const slug = `future-publication-${id}`
  const body = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] })
  const date = new Date(Date.now() + 365 * 86_400_000).toISOString()
  try {
    await sql`insert into posts (id, slug, title, status, published_at, content_json)
      values (${id}::uuid, ${slug}, 'Future publication fixture', 'published', ${date}::timestamptz, ${body}::jsonb)`
    expect((await request.get(`/writing/${slug}`)).status()).toBe(404)
    const endpoint = `/api/writing/posts/${slug}/reactions`
    const read = await request.get(endpoint)
    expect(read.status()).toBe(404)
    expect(read.headers()["cache-control"]).toBe("no-store")
    const write = await request.put(endpoint, {
      headers: { origin: E2E_BASE_URL },
      data: { visitorId: crypto.randomUUID(), reaction: "love", active: true },
    })
    expect(write.status()).toBe(404)
    const rows =
      await sql`select count(*)::int as total from post_reactions where post_id = ${id}::uuid`
    expect(rows[0].total).toBe(0)
    for (const path of ["/writing/rss.xml", "/sitemap.xml"]) {
      const response = await request.get(path)
      expect(response.headers()["cache-control"]).toBe("no-cache, must-revalidate")
      expect(await response.text()).not.toContain(slug)
    }
  } finally {
    await sql`delete from posts where id = ${id}::uuid`
  }
})
