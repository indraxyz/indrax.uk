import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter, Route, Routes } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it, vi } from "vitest"

vi.mock("@/features/writing/api/client", () => ({
  writingApi: { tags: vi.fn(), posts: vi.fn() },
  writingKeys: {
    tags: () => ["writing", "tags"],
    posts: (page: number, tag: string) => ["writing", "posts", page, tag],
  },
}))
import TagPage from "@/routes/writing-tag"

function renderTag(client: QueryClient) {
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: ["/writing/tags/typescript"] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: "/writing/tags/:tag", element: createElement(TagPage) })
        )
      )
    )
  )
}

it("generates tag breadcrumb structured data from the same client data as the visible trail", () => {
  const client = new QueryClient()
  client.setQueryData(
    ["writing", "tags"],
    [{ id: "tag-id", name: "TypeScript", slug: "typescript", postCount: 1 }]
  )
  client.setQueryData(["writing", "posts", 1, "typescript"], { posts: [], page: 1, pageCount: 0 })
  const html = renderTag(client)
  const block = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1]
  expect(block).toBeDefined()
  const trail = JSON.parse(block!).itemListElement
  expect(trail.map((item: { name: string }) => item.name)).toEqual([
    "Home",
    "Writing",
    "TypeScript",
  ])
  expect(trail.at(-1).item).toMatch(/\/writing\/tags\/typescript$/)
  expect(html).toContain('aria-current="page"')
})

it("marks a tag unavailable after the public API resolves as noindex", () => {
  const client = new QueryClient()
  client.setQueryData(["writing", "tags"], [])
  const html = renderTag(client)
  expect(html).toContain('name="robots" content="noindex,follow"')
  expect(html).toContain("This tag has no published articles.")
  expect(html).not.toContain('"@type":"BreadcrumbList"')
})
