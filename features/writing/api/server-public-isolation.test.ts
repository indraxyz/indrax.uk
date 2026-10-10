import { expect, it, vi } from "vitest"
import type { Post } from "@/features/writing/types"

// Simulate unavailable optional/private processors. Public cards and cached article
// HTML must remain usable without initializing these unrelated dependency trees.
vi.mock("@/features/writing/utils/content", () => {
  throw new Error("Document processor initialized")
})
vi.mock("@/features/writing/utils/preview-token", () => {
  throw new Error("Preview signer initialized")
})
vi.mock("@/features/writing/data/admin-queries", () => {
  throw new Error("Admin queries initialized")
})
vi.mock("@/features/writing/data/mutations", () => {
  throw new Error("Authoring initialized")
})
vi.mock("@/lib/auth", () => {
  throw new Error("Authentication initialized")
})
vi.mock("@/lib/auth-guard", () => {
  throw new Error("Author guard initialized")
})
vi.mock("@/lib/cover-storage", () => {
  throw new Error("Upload configuration initialized")
})
vi.mock("@/lib/validators/writing", () => {
  throw new Error("Authoring validation initialized")
})
vi.mock("@/features/writing/data/queries", () => ({
  CACHE_TAGS: { post: (slug: string) => `post:${slug}` },
  getArchivePosts: async () => ({ posts: [], page: 1, pageCount: 0, total: 0 }),
  getPublishedPosts: async () => ({ posts: [], page: 1, pageCount: 0 }),
  getRecentPosts: async () => [],
  getTagsInUse: async () => [],
}))
vi.mock("@/lib/cache.server", () => ({
  cachedRead: async () => ({ html: "<p>Saved HTML</p>", headings: [] }),
}))
import { handleWritingApi } from "./server"
import { getRenderedArticle } from "@/features/writing/data/rendered-article"
it("serves public writing cards without authoring, auth or document processors", async () => {
  for (const path of ["posts", "recent", "tags"]) {
    const response = await handleWritingApi(new Request(`https://example.test/api/writing/${path}`))
    expect(response?.status).toBe(200)
  }
})
it("rejects malformed previews before initializing signing or document processing", async () => {
  const response = await handleWritingApi(
    new Request("https://example.test/api/writing/preview/draft?token=malformed")
  )
  expect(response?.status).toBe(404)
})
it("serves already rendered article HTML without initializing the document processor", async () => {
  const article = await getRenderedArticle({
    id: "post",
    slug: "article",
    status: "published",
    updatedAt: "2026-10-09",
    content: { type: "doc" },
  } as Post)
  expect(article).toEqual({ html: "<p>Saved HTML</p>", headings: [] })
})
