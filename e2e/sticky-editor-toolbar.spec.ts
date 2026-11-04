import { expect, test, type Page } from "@playwright/test"

import type { AdminPost } from "@/features/writing/types"

import { expectBelowVisibleHeader } from "./support/sticky-archive-controls"

async function longPostEditor(page: Page) {
  const post: AdminPost = {
    id: "sticky-editor-fixture",
    slug: "sticky-editor-fixture",
    title: "Long article for sticky formatting controls",
    excerpt: null,
    coverUrl: null,
    coverAlt: null,
    status: "draft",
    publishedAt: null,
    updatedAt: "2026-11-04T00:00:00Z",
    tags: [],
    seriesTitle: null,
    seriesDescription: null,
    seriesOrder: null,
    content: {
      type: "doc",
      content: Array.from({ length: 80 }, (_, index) => ({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: `Paragraph ${index + 1}. Formatting stays available while editing a long article.`,
          },
        ],
      })),
    },
  }
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
  await page.route("**/api/admin/tags", (route) => route.fulfill({ json: [] }))
  await page.route(`**/api/admin/posts/${post.id}`, (route) => route.fulfill({ json: post }))
  await page.goto(`/admin/posts/edit/${post.id}`)
  await expect(page.locator(".ProseMirror p")).toHaveCount(80)
  const formatting = page.getByRole("toolbar", { name: "Formatting", exact: true })
  await expect(formatting.getByRole("button", { name: "Bold", exact: true })).toBeVisible()
  // Sticky positioning belongs to the wrapper around the horizontally scrolling controls.
  return { formatting, wrapper: page.locator("[data-editor-toolbar]") }
}

for (const width of [320, 1280]) {
  test(`editor formatting follows the visible header while scrolling and resizing at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 720 })
    const { formatting, wrapper } = await longPostEditor(page)
    const header = page.locator("[data-admin-header]")
    const initialTop = (await wrapper.boundingBox())!.y
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), initialTop + 400)
    await expect(header).toHaveAttribute("data-scroll-hidden", "true")
    await expectBelowVisibleHeader(page, wrapper)
    await expect(formatting.getByRole("button", { name: "Bold", exact: true })).toBeVisible()

    const largestTransitionGap = await page.evaluate(async () => {
      window.scrollBy({ top: -100, behavior: "instant" })
      const gaps: number[] = []
      for (let frame = 0; frame < 18; frame += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        const navigation = document.querySelector("[data-admin-header]")!.getBoundingClientRect()
        const controls = document.querySelector("[data-editor-toolbar]")!.getBoundingClientRect()
        gaps.push(Math.abs(controls.top - Math.max(0, navigation.bottom)))
      }
      return Math.max(...gaps)
    })
    expect(largestTransitionGap).toBeLessThanOrEqual(2)
    await expect(header).toHaveAttribute("data-scroll-hidden", "false")
    await expectBelowVisibleHeader(page, wrapper)

    await page.setViewportSize({ width: width === 320 ? 1280 : 320, height: 720 })
    await expectBelowVisibleHeader(page, wrapper)
    await page.evaluate(() => window.scrollBy({ top: 160, behavior: "instant" }))
    await expect(header).toHaveAttribute("data-scroll-hidden", "true")
    await expectBelowVisibleHeader(page, wrapper)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width
    )

    const bold = formatting.getByRole("button", { name: "Bold", exact: true })
    await bold.focus()
    await expect(bold).toBeFocused()
    await expectBelowVisibleHeader(page, wrapper)
    await page.keyboard.press("Space")
    await expect(page.locator(".ProseMirror")).toBeFocused()
    await expect(bold).toHaveAttribute("aria-pressed", "true")
  })
}

test("editor sticky formatting follows reduced-motion navigation and prints in document flow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.emulateMedia({ reducedMotion: "reduce" })
  const { wrapper } = await longPostEditor(page)
  const top = (await wrapper.boundingBox())!.y + 400
  await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), top)
  await expect(page.locator("[data-admin-header]")).toHaveAttribute("data-scroll-hidden", "true")
  await expectBelowVisibleHeader(page, wrapper)
  await page.emulateMedia({ media: "print", reducedMotion: "reduce" })
  await expect(wrapper).toHaveCSS("position", "static")
})
