import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it, vi } from "vitest"

const recent = vi.hoisted(() => vi.fn())
vi.mock("@/features/writing/api/client", () => ({
  writingApi: { recent },
  writingKeys: { recent: (limit: number) => ["writing", "recent", limit] },
}))

import { WritingSection } from "@/features/home/components/writing-section"

it("renders loading geometry without querying the API during server rendering", () => {
  const client = new QueryClient()
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MemoryRouter, null, createElement(WritingSection))
    )
  )
  expect(html).toContain("Loading recent writing…")
  expect(html).toContain("data-loading-skeleton")
  expect(html).not.toContain('aria-roledescription="carousel"')
  expect(recent).not.toHaveBeenCalled()
})

it("removes the home writing section after a successful empty response", () => {
  const client = new QueryClient()
  client.setQueryData(["writing", "recent", 9], [])
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MemoryRouter, null, createElement(WritingSection))
    )
  )
  expect(html).toBe("")
})

it("renders writing cards from the browser query cache", () => {
  const client = new QueryClient()
  client.setQueryData(
    ["writing", "recent", 9],
    [
      {
        id: "post-id",
        slug: "browser-card",
        title: "Browser card",
        excerpt: "Loaded through the writing API",
        coverUrl: null,
        coverAlt: null,
        publishedAt: "2026-10-09T00:00:00Z",
        updatedAt: "2026-10-09T00:00:00Z",
        readingTime: 1,
        tags: [],
      },
    ]
  )
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MemoryRouter, null, createElement(WritingSection))
    )
  )
  expect(html).toContain("Browser card")
  expect(html).not.toContain("data-loading-skeleton")
  expect(html).toContain('href="/writing/browser-card"')
})

it("lays nine recent posts out as a named, keyboard-scrollable rail of grid-width cards", () => {
  const client = new QueryClient()
  client.setQueryData(
    ["writing", "recent", 9],
    Array.from({ length: 9 }, (_, index) => ({
      id: `post-${index}`,
      slug: `post-${index}`,
      title: `Post ${index}`,
      excerpt: null,
      coverUrl: null,
      coverAlt: null,
      publishedAt: "2026-10-09T00:00:00Z",
      updatedAt: "2026-10-09T00:00:00Z",
      readingTime: 1,
      tags: [],
    }))
  )
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MemoryRouter, null, createElement(WritingSection))
    )
  )
  expect(html).toMatch(
    /tabindex="0"[^>]*aria-label="Writing"|aria-label="Writing"[^>]*tabindex="0"/
  )
  expect(html).toContain("overflow-x-auto")
  expect(html).not.toContain("data-post-grid")
  expect(html.match(/href="\/writing\/post-\d"/g)).toHaveLength(9)
  expect(html.match(/lg:w-\[calc\(\(min\(100cqw,90rem\)_-_5rem\)_\/_3\)\]/g)).toHaveLength(9)
})
