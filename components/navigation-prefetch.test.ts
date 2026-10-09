import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
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
      MemoryRouter,
      null,
      createElement(PostRow, {
        post: {
          id: "post-id",
          title: "Post title",
          slug: "post-title",
          status: "published",
          publishedAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          tags: [],
        },
      })
    )
  )
  expect(html).not.toContain('rel="prefetch"')
  expect(html).toContain('href="/admin/edit/post-id"')
  expect(html).toContain('href="/writing/post-title"')
})
