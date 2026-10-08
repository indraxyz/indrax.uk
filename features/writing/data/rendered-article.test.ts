import { AsyncLocalStorage } from "node:async_hooks"

import { afterAll, beforeEach, expect, it, vi } from "vitest"

import type { Post } from "@/features/writing/types"

vi.mock("@/features/writing/data/queries", () => ({
  CACHE_TAGS: { post: (slug: string) => `post:${slug}` },
}))

vi.mock("@/features/writing/utils/content", () => ({
  renderDocument: vi.fn(async () => ({ html: "<p>Saved article</p>", headings: [] })),
}))

// Exercise Next's actual unstable_cache with an isolated storage adapter. This
// verifies cache hits/invalidation rather than substituting the cache function.
vi.stubGlobal("AsyncLocalStorage", AsyncLocalStorage)
const { getRenderedArticle } = await import("./rendered-article")
const { renderDocument } = await import("@/features/writing/utils/content")

interface StoredEntry {
  value: { kind: string; data: { body: string } }
  tags: string[]
}

const entries = new Map<string, StoredEntry>()
const invalidated = new Set<string>()

beforeEach(() => {
  entries.clear()
  invalidated.clear()
  vi.mocked(renderDocument).mockClear()
  vi.stubGlobal("__incrementalCache", {
    generateSimpleCacheKey: async (key: string) => key,
    get: async (key: string) => {
      const entry = entries.get(key)
      if (!entry || entry.tags.some((tag) => invalidated.has(tag))) return null
      return { value: entry.value, isStale: false }
    },
    set: async (key: string, value: StoredEntry["value"], context: { tags: string[] }) => {
      entries.set(key, { value, tags: context.tags })
    },
  })
})

afterAll(() => vi.unstubAllGlobals())

const post = {
  id: "published-id",
  slug: "saved-article",
  status: "published",
  updatedAt: "2026-10-08T00:00:00.000Z",
  content: { type: "doc", content: [{ type: "paragraph" }] },
} as Post

it("reuses the rendered HTML and headings for the same saved revision", async () => {
  const first = await getRenderedArticle(post)
  expect(await getRenderedArticle({ ...post })).toEqual(first)
  expect(renderDocument).toHaveBeenCalledTimes(1)
})

it("renders again when the article revision changes", async () => {
  await getRenderedArticle(post)
  await getRenderedArticle({ ...post, updatedAt: "2026-10-08T00:01:00.000Z" })
  expect(renderDocument).toHaveBeenCalledTimes(2)
})

it("expires the render using the same per-slug tag as post mutations", async () => {
  await getRenderedArticle(post)
  invalidated.add(`post:${post.slug}`)
  await getRenderedArticle(post)
  expect(renderDocument).toHaveBeenCalledTimes(2)
})

it("keeps another article's render when an unrelated post changes", async () => {
  await getRenderedArticle(post)
  invalidated.add("post:another-article")
  await getRenderedArticle(post)
  expect(renderDocument).toHaveBeenCalledTimes(1)
})

it("uses a separate entry for a changed slug", async () => {
  await getRenderedArticle(post)
  await getRenderedArticle({ ...post, slug: "renamed-article" })
  expect(renderDocument).toHaveBeenCalledTimes(2)
})

it("refuses to put draft or archived content in the public render cache", () => {
  for (const status of ["draft", "archived"] as const) {
    expect(() => getRenderedArticle({ ...post, status })).toThrow("Only published articles")
  }
  expect(renderDocument).not.toHaveBeenCalled()
  expect(entries.size).toBe(0)
})
