import { beforeEach, describe, expect, it, vi } from "vitest"

const queries = vi.hoisted(() => ({ post: vi.fn(), related: vi.fn(), article: vi.fn() }))
vi.mock("@/features/writing/data/queries", () => ({
  getPostBySlug: queries.post,
  getRelatedPosts: queries.related,
}))
vi.mock("@/features/writing/data/rendered-article", () => ({ getRenderedArticle: queries.article }))

import { loader, meta } from "@/routes/writing-detail"
import { RouterContextProvider, type LoaderFunctionArgs } from "react-router"

const post = {
  id: "post-id",
  slug: "article",
  title: "Article title",
  excerpt: "Article description",
  coverUrl: null,
  coverAlt: null,
  publishedAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-08T00:00:00.000Z",
  readingTime: 1,
  tags: [{ id: "tag-id", name: "React", slug: "react" }],
  status: "published",
  content: { type: "doc", content: [{ type: "paragraph" }] },
  viewCount: 0,
  seriesContext: null,
}
const args = {
  params: { slug: "article" },
  url: new URL("https://indrax.uk/writing/article"),
  pattern: "/writing/:slug",
  request: new Request("https://indrax.uk/writing/article"),
  context: new RouterContextProvider(),
} as LoaderFunctionArgs

beforeEach(() => {
  vi.clearAllMocks()
  queries.post.mockResolvedValue(post)
  queries.related.mockResolvedValue([])
  queries.article.mockResolvedValue({ html: "<p>Server rendered article</p>", headings: [] })
})

describe("public article SSR", () => {
  it("loads published content and sends rendered HTML without the editor document", async () => {
    const result = await loader(args)
    expect(queries.post).toHaveBeenCalledWith("article")
    expect(queries.related).toHaveBeenCalledWith("post-id")
    expect(queries.article).toHaveBeenCalledWith(post)
    expect(result.article.html).toContain("Server rendered article")
    expect(result.post).not.toHaveProperty("content")
    expect(result.post.title).toBe(post.title)
  })

  it("returns the same 404 for an unavailable or unpublished article", async () => {
    queries.post.mockResolvedValue(null)
    await expect(loader(args)).rejects.toMatchObject({ status: 404 })
    expect(queries.article).not.toHaveBeenCalled()
    expect(queries.related).not.toHaveBeenCalled()
  })

  it("emits canonical and article metadata from the loaded public post", async () => {
    const data = await loader(args)
    const metadata = meta({ loaderData: data } as Parameters<typeof meta>[0])
    expect(metadata).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: "https://indrax.uk/writing/article",
    })
    expect(metadata).toContainEqual({ property: "og:type", content: "article" })
    expect(metadata).toContainEqual({ property: "article:tag", content: "React" })
  })
})
