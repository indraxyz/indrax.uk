import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"

import type { AdminPostSummary } from "@/features/writing/types"
import {
  defaultAdminArchiveOptions,
  type AdminArchiveOptions,
} from "@/features/writing/utils/admin-archive-options"

import { PostTable } from "./post-table"

const posts: AdminPostSummary[] = [
  {
    id: "published-id",
    slug: "published",
    title: "Published post",
    excerpt: "Excerpt",
    coverUrl: null,
    coverAlt: null,
    status: "published",
    publishedAt: "2026-10-01T12:00:00Z",
    updatedAt: "2026-10-02T12:00:00Z",
    tags: [
      { id: "tag-ts", slug: "typescript", name: "TypeScript" },
      { id: "tag-react", slug: "react", name: "React" },
    ],
  },
  {
    id: "draft-id",
    slug: "draft",
    title: "Draft post",
    excerpt: null,
    coverUrl: null,
    coverAlt: null,
    status: "draft",
    publishedAt: null,
    updatedAt: "2026-10-03T12:00:00Z",
    tags: [],
  },
]

const render = (options: Partial<AdminArchiveOptions> = {}) =>
  renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(
        MemoryRouter,
        null,
        createElement(PostTable, { posts, options: { ...defaultAdminArchiveOptions, ...options } })
      )
    )
  )

/** The rendered <th> for a column, by its visible label. */
const headerFor = (html: string, label: string) =>
  html.match(new RegExp(`<th scope="col"[^>]*>(?:(?!</th>).)*${label}(?:(?!</th>).)*</th>`))?.[0]

describe("PostTable", () => {
  it("renders a captioned, scrollable table with row headers and one row per post", () => {
    const html = render()
    expect(html).toMatch(/<div role="region" aria-labelledby="([^"]+)" tabindex="0"/)
    const captionId = html.match(/aria-labelledby="([^"]+)"/)![1]
    expect(html).toContain(`<caption id="${captionId}" class="sr-only">`)
    expect(html).toContain("Posts, ordered by recently updated")
    expect(html.match(/<th scope="row"/g)).toHaveLength(2)
    expect(html).toContain('href="/admin/posts/edit/published-id"')
    expect(html).toContain('aria-label="Edit Draft post"')
    expect(html).toContain('aria-label="Actions for Published post"')
  })

  it("shows status, tags and dates, with readable empty values", () => {
    const html = render()
    expect(html).toContain("TypeScript, React")
    expect(html).toContain('<span class="sr-only">No tags</span>')
    expect(html).toContain('<time dateTime="2026-10-01T12:00:00Z">Oct 1, 2026</time>')
    expect(html).toContain("Not published")
    expect(html).toMatch(/>published</)
    expect(html).toMatch(/>draft</)
  })

  it("marks the server ordering on its column and offers the other direction", () => {
    const html = render({ sort: "title-asc" })
    const title = headerFor(html, "Title")!
    expect(title).toContain('aria-sort="ascending"')
    expect(title).toContain("<button")
    expect(title).toContain('aria-label="Title: sort Z to A"')
    // Only the sorted column carries aria-sort.
    expect(html.match(/aria-sort=/g)).toHaveLength(1)
    expect(headerFor(html, "Published")).toContain('aria-label="Published: sort newest first"')
  })

  it("does not offer a no-op button for the single-direction Updated column", () => {
    const html = render({ sort: "updated" })
    const updated = headerFor(html, "Updated")!
    expect(updated).toContain('aria-sort="descending"')
    expect(updated).not.toContain("<button")
  })

  it("never offers sorting on columns the backend cannot order", () => {
    const html = render()
    expect(headerFor(html, "Status")).not.toContain("<button")
    expect(headerFor(html, "Tags")).not.toContain("<button")
    expect(headerFor(html, "Actions")).toContain('<span class="sr-only">Actions</span>')
  })

  it("leaves every header unsorted for orderings without a column", () => {
    expect(render({ sort: "views" })).not.toContain("aria-sort=")
  })
})
