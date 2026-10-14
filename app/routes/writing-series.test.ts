import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter, Route, Routes } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { expect, it, vi } from "vitest"

const series = vi.hoisted(() => vi.fn())
vi.mock("@/features/writing/api/client", () => ({
  writingApi: { series },
  writingKeys: { series: (slug: string) => ["writing", "series", slug] },
}))
import SeriesPage from "@/app/routes/writing-series"

function render(client: QueryClient) {
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: ["/writing/series/example"] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: "/writing/series/:slug",
            element: createElement(SeriesPage),
          })
        )
      )
    )
  )
}

it("renders the series shell without executing a server writing query or API call", () => {
  const html = render(new QueryClient())
  expect(html).toContain("Loading writing")
  expect(series).not.toHaveBeenCalled()
})

it("renders ordered parts from client query data", () => {
  const client = new QueryClient()
  client.setQueryData(["writing", "series", "example"], {
    series: { id: "series-id", title: "Example series", slug: "example", description: null },
    parts: [
      {
        slug: "first-part",
        title: "First part",
        order: 1,
        excerpt: null,
        readingTime: 1,
        publishedAt: "2026-10-09T00:00:00Z",
      },
    ],
  })
  const html = render(client)
  expect(html).toContain("Example series")
  expect(html).toContain('href="/writing/first-part"')
})
