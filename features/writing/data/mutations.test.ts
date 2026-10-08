import { beforeEach, describe, expect, it, vi } from "vitest"

import { schema } from "@/lib/db"

const mocks = vi.hoisted(() => ({
  requireAuthor: vi.fn(),
  getDb: vi.fn(),
  updateTag: vi.fn(),
}))
vi.mock("@/lib/auth-guard", () => ({ requireAuthor: mocks.requireAuthor }))
vi.mock("next/cache", () => ({ updateTag: mocks.updateTag }))
vi.mock("@/features/writing/data/queries", () => ({
  CACHE_TAGS: { posts: "posts", post: (slug: string) => `post:${slug}` },
}))
vi.mock("@/lib/db", async () => ({
  getDb: mocks.getDb,
  schema: await import("@/lib/db/schema"),
}))

import { savePost } from "./mutations"

const ID = "550e8400-e29b-41d4-a716-446655440000"
const payload = {
  title: "New title",
  slug: "new-title",
  status: "published" as const,
  tags: [],
  content: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "A body for the article." }] }],
  },
}

/** Fluent database fixture; only external I/O is replaced, not validation or derived fields. */
function database(selectResults: unknown[][]) {
  const returning = vi.fn().mockResolvedValue([{ id: ID, slug: payload.slug }])
  const set = vi.fn().mockReturnValue({ where: () => ({ returning }) })
  const values = vi.fn().mockReturnValue({ returning })
  const select = vi.fn().mockImplementation(() => {
    const result = Promise.resolve(selectResults.shift() ?? [])
    return {
      from: () => ({ where: () => ({ limit: () => result, then: result.then.bind(result) }) }),
    }
  })
  const db = {
    select,
    update: vi.fn().mockReturnValue({ set }),
    insert: vi.fn().mockReturnValue({ values }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  }
  mocks.getDb.mockReturnValue(db)
  return { ...db, set, values, returning }
}

beforeEach(() => vi.resetAllMocks())

describe("savePost", () => {
  it("authorizes before reading or writing a database", async () => {
    mocks.requireAuthor.mockRejectedValue(new Error("Unauthorized"))
    await expect(savePost(payload)).rejects.toThrow("Unauthorized")
    expect(mocks.getDb).not.toHaveBeenCalled()
    expect(mocks.updateTag).not.toHaveBeenCalled()
  })

  it("rejects invalid input without database reads or cache invalidation", async () => {
    const db = database([])
    expect(await savePost({ ...payload, title: "" })).toMatchObject({ ok: false })
    expect(db.select).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
    expect(mocks.updateTag).not.toHaveBeenCalled()
  })

  it("creates a published post with an excerpt and reading time derived from the submitted body", async () => {
    const db = database([[]])
    expect(await savePost(payload)).toEqual({ ok: true, postId: ID })
    expect(db.values).toHaveBeenCalledWith(
      expect.objectContaining({
        contentJson: payload.content,
        excerpt: "A body for the article.",
        publishedAt: expect.any(Date),
        readingTime: 1,
        status: "published",
      })
    )
    expect(mocks.updateTag.mock.calls).toEqual([["posts"], ["post:new-title"]])
  })

  it("updates without selecting the old body and preserves publication time and both slug invalidations", async () => {
    const publishedAt = new Date("2026-01-01T00:00:00Z")
    const db = database([[{ id: ID, slug: "old-title", publishedAt }], []])
    expect(await savePost({ ...payload, id: ID, excerpt: "An author-written excerpt." })).toEqual({
      ok: true,
      postId: ID,
    })
    expect(db.select.mock.calls[0]).toEqual([
      { id: schema.posts.id, slug: schema.posts.slug, publishedAt: schema.posts.publishedAt },
    ])
    expect(db.set).toHaveBeenCalledWith(
      expect.objectContaining({ publishedAt, excerpt: "An author-written excerpt." })
    )
    expect(db.insert).not.toHaveBeenCalled()
    expect(mocks.updateTag.mock.calls).toEqual([["posts"], ["post:new-title"], ["post:old-title"]])
  })

  it("rejects a slug collision before writing or invalidating", async () => {
    const db = database([[{ id: ID, slug: "old-title", publishedAt: null }], [{ id: "other" }]])
    expect(await savePost({ ...payload, id: ID })).toMatchObject({
      ok: false,
      errors: { slug: ["Another post already uses this slug."] },
    })
    expect(db.set).not.toHaveBeenCalled()
    expect(mocks.updateTag).not.toHaveBeenCalled()
  })

  it("does not publish an empty body", async () => {
    const db = database([[]])
    expect(await savePost({ ...payload, content: { type: "doc", content: [] } })).toMatchObject({
      ok: false,
      errors: { content: ["An article needs a body."] },
    })
    expect(db.insert).not.toHaveBeenCalled()
    expect(mocks.updateTag).not.toHaveBeenCalled()
  })
})
