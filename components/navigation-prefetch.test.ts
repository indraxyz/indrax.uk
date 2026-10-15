import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"
import { expect, it } from "vitest"

import { PublicNavigation } from "@/components/public-navigation"
import { PostRow } from "@/features/writing/components/admin/post-row"

it("keeps public navigation clickable without speculative page requests", () => {
  const html = renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(PublicNavigation))
  )
  expect(html).not.toContain('rel="prefetch"')
  for (const href of ["/", "/resume", "/writing", "/tech-stack"]) {
    expect(html).toContain(`href="${href}"`)
  }
})

it("does not prefetch edit forms and article rendering from each admin post row", () => {
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(
        MemoryRouter,
        null,
        createElement(PostRow, {
          post: {
            id: "post-id",
            title: "Post title",
            slug: "post-title",
            status: "published",
            excerpt: null,
            coverUrl: null,
            coverAlt: null,
            publishedAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
            tags: [],
          },
        })
      )
    )
  )
  expect(html).not.toContain('rel="prefetch"')
  expect(html).toContain('href="/admin/edit/post-id"')
  expect(html).toContain('aria-label="Actions for Post title"')
})
