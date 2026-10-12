import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AdminPostSummary } from "@/features/writing/types"
import { deriveExcerptText } from "@/features/writing/utils/plain-text"

import { PostRow } from "./post-row"

const post: AdminPostSummary = {
  id: "post-id",
  slug: "sample",
  title: "Sample post",
  excerpt: "An excerpt about the sample post.",
  coverUrl: "https://media.indrax.uk/covers/sample.png",
  coverAlt: "Sample cover",
  status: "published",
  publishedAt: "2026-10-01T12:00:00Z",
  updatedAt: "2026-10-02T12:00:00Z",
  tags: [{ id: "tag-id", slug: "typescript", name: "TypeScript" }],
}

const render = (changes: Partial<AdminPostSummary> = {}) =>
  renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(PostRow, { post: { ...post, ...changes } }))
  )

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_MEDIA_ORIGIN", "https://media.indrax.uk"))
afterEach(() => vi.unstubAllEnvs())

describe("PostRow", () => {
  it("shows a lazy trusted cover before the title and preserves metadata and actions", () => {
    const html = render()

    expect(html).toContain(`src="${post.coverUrl}"`)
    expect(html).toContain('alt="Sample cover"')
    expect(html).toContain('loading="lazy"')
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf("Sample post"))
    expect(html).toContain("h-40 w-full shrink-0 self-stretch")
    expect(html).toContain("sm:h-auto sm:w-48")
    expect(html).toContain("lg:w-56")
    expect(html).toContain("border-b-2")
    expect(html).toContain("sm:border-b-0 sm:border-r-2")
    expect(html).toContain("[&amp;_img]:absolute")
    expect(html).toContain("[&amp;_img]:inset-0")
    expect(html).toContain("[&amp;_img]:h-full")
    expect(html).toContain("[&amp;_img]:aspect-auto")
    expect(html).toContain(
      '<li class="flex flex-col items-stretch border-2 border-border bg-card sm:flex-row">'
    )
    expect(html).toContain("published")
    expect(html).toContain("Published ")
    expect(html).toContain("Edited ")
    expect(html).toContain("TypeScript")
    expect(html).toContain('href="/admin/edit/post-id"')
    expect(html).toContain('aria-label="Edit Sample post"')
    expect(html).toContain('href="/writing/sample"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it("uses the stored word-boundary excerpt and limits its visible lines", () => {
    const excerpt = deriveExcerptText("A longer excerpt ".repeat(20))
    const html = render({ excerpt })

    expect(excerpt).toMatch(/\.\.\.$/)
    expect(html).toContain(excerpt)
    expect(html).toContain("line-clamp-2 break-words")
    expect(html).toContain("min-w-0 basis-full")
    expect(html).toContain("sm:basis-0")
    expect(html).toContain("ml-auto flex shrink-0")
  })

  it.each([
    null,
    "https://media.indrax.uk.evil.test/cover.png",
    "http://media.indrax.uk/cover.png",
  ])("omits an unavailable or untrusted cover (%s)", (coverUrl) => {
    const html = render({ coverUrl, excerpt: null, status: "draft", publishedAt: null })

    expect(html).not.toContain("<img")
    expect(html).not.toContain("line-clamp-2")
    expect(html).toContain("Never published")
    expect(html).toContain('aria-label="Edit Sample post"')
    expect(html).not.toContain('href="/writing/sample"')
  })

  it("escapes stored excerpts as text", () => {
    const html = render({ excerpt: "<script>alert('excerpt')</script>" })

    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
  })
})
