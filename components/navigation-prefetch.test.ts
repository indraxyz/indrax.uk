import { createElement, type ComponentProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ prefetch, ...props }: ComponentProps<"a"> & { prefetch?: boolean }) =>
    createElement("a", { ...props, "data-prefetch": String(prefetch) }),
}))

import { PublicNavigation } from "@/components/public-navigation"
import { PostRow } from "@/features/writing/components/admin/post-row"

it("keeps public navigation clickable without speculative page requests", () => {
  const html = renderToStaticMarkup(createElement(PublicNavigation))
  expect(html.match(/data-prefetch="false"/g)).toHaveLength(4)
  for (const href of ["/", "/resume", "/writing", "/tech-stack"]) {
    expect(html).toContain(`href="${href}"`)
  }
})

it("does not prefetch edit forms and article rendering from each admin post row", () => {
  const html = renderToStaticMarkup(
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
  expect(html.match(/data-prefetch="false"/g)).toHaveLength(3)
  expect(html).toContain('href="/admin/edit/post-id"')
  expect(html).toContain('href="/writing/post-title"')
})
