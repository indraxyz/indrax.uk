import { beforeEach, describe, expect, it, vi } from "vitest"
import { drizzle } from "drizzle-orm/neon-http"
import type { SQL } from "drizzle-orm"

import { schema } from "@/lib/db"

const mocks = vi.hoisted(() => ({
  requireAuthor: vi.fn(),
  getDb: vi.fn(),
  updateTag: vi.fn(),
}))
vi.mock("@/lib/auth-guard", () => ({ requireAuthor: mocks.requireAuthor }))
vi.mock("@/lib/cache.server", () => ({
  invalidateTags: async (...tags: string[]) => {
    tags.forEach((tag) => mocks.updateTag(tag))
  },
}))
vi.mock("@/features/writing/data/queries", () => ({
  CACHE_TAGS: { posts: "posts", post: (slug: string) => `post:${slug}` },
}))
vi.mock("@/lib/db", async () => ({
  getDb: mocks.getDb,
  schema: await import("@/lib/db/schema"),
}))

import { deletePost, savePost, setPostStatus } from "./mutations"

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
  const onConflictDoUpdate = vi.fn().mockReturnValue({ returning })
  const onConflictDoNothing = vi.fn().mockReturnValue({ returning })
  const values = vi.fn().mockReturnValue({ returning, onConflictDoNothing, onConflictDoUpdate })
  const insertSelect = vi.fn().mockReturnValue({ onConflictDoNothing })
  const batch = vi.fn().mockResolvedValue([[{ id: ID, slug: payload.slug }]])
  const select = vi.fn().mockImplementation((projection) => {
    if (projection?.id === schema.tags.id || projection?.tagId === schema.tags.id) {
      return drizzle.mock().select(projection)
    }
    const result = Promise.resolve(selectResults.shift() ?? [])
    return {
      from: () => ({ where: () => ({ limit: () => result, then: result.then.bind(result) }) }),
    }
  })
  const deleteWhere = vi.fn().mockReturnValue({ returning })
  const db = {
    select,
    update: vi.fn().mockReturnValue({ set }),
    insert: vi.fn().mockReturnValue({ values, select: insertSelect }),
    batch,
    delete: vi.fn().mockReturnValue({ where: deleteWhere }),
  }
  mocks.getDb.mockReturnValue(db)
  return { ...db, set, values, returning, onConflictDoUpdate, insertSelect, deleteWhere }
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
      expect.objectContaining({
        id: schema.posts.id,
        slug: schema.posts.slug,
        publishedAt: schema.posts.publishedAt,
      }),
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

describe("savePost database round trips", () => {
  it("synchronizes submitted tags atomically while retaining existing desired joins", async () => {
    const db = database([[{ id: ID, slug: payload.slug, publishedAt: null }]])
    expect(await savePost({ ...payload, id: ID, tags: ["REACT", "Next.js", "next js"] })).toEqual({
      ok: true,
      postId: ID,
    })
    expect(db.batch.mock.calls[0][0]).toHaveLength(4)
    expect(db.values).toHaveBeenCalledWith([
      { slug: "react", name: "REACT" },
      { slug: "next-js", name: "Next.js" },
    ])
    const condition = db.deleteWhere.mock.calls[0][0] as SQL
    const { sql: generated } = drizzle.mock().delete(schema.postTags).where(condition).toSQL()
    expect(generated).toContain('"post_tags"."tag_id" not in (select "id" from "tags"')
    expect(generated).toContain('"post_tags"."post_id" =')
  })

  it("atomically batches changed tag joins with the post and preserves the first display spelling", async () => {
    const db = database([[{ id: ID, slug: payload.slug, publishedAt: null }]])
    expect(await savePost({ ...payload, id: ID, tags: ["Next.js", "NEXT JS"] })).toEqual({
      ok: true,
      postId: ID,
    })
    expect(db.batch).toHaveBeenCalledTimes(1)
    expect(db.batch.mock.calls[0][0]).toHaveLength(4)
    expect(db.values).toHaveBeenCalledWith([{ slug: "next-js", name: "Next.js" }])
    expect(db.insertSelect).toHaveBeenCalledTimes(1)
    expect(db.delete).toHaveBeenCalledWith(schema.postTags)
  })

  it("clears removed tags in the same batch without creating or reading tag rows", async () => {
    const db = database([[{ id: ID, slug: payload.slug, publishedAt: null }]])
    expect(await savePost({ ...payload, id: ID })).toMatchObject({ ok: true })
    expect(db.batch.mock.calls[0][0]).toHaveLength(2)
    expect(db.select).toHaveBeenCalledTimes(1)
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("assigns a new post ID before batching its tag joins", async () => {
    const db = database([[]])
    expect(await savePost({ ...payload, tags: ["React"] })).toMatchObject({ ok: true })
    expect(db.values).toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.stringMatching(/^[a-f0-9-]{36}$/) })
    )
    expect(db.batch.mock.calls[0][0]).toHaveLength(4)
  })

  it("resolves a series in one returning upsert and preserves its description when empty", async () => {
    const db = database([[{ id: ID, slug: payload.slug, publishedAt: null }]])
    expect(
      await savePost({
        ...payload,
        id: ID,
        seriesTitle: "A Series",
        seriesOrder: 1,
        seriesDescription: "",
      })
    ).toMatchObject({ ok: true })
    expect(db.select).toHaveBeenCalledTimes(1)
    expect(db.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: schema.series.slug,
        set: { description: expect.anything(), updatedAt: expect.anything() },
      })
    )
    expect(db.set).toHaveBeenCalledWith(expect.objectContaining({ seriesId: ID }))
  })

  it("updates a supplied series description in the same upsert", async () => {
    const db = database([[{ id: ID, slug: payload.slug, publishedAt: null }]])
    await savePost({
      ...payload,
      id: ID,
      seriesTitle: "A Series",
      seriesDescription: "A new description",
      seriesOrder: 1,
    })
    expect(db.onConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        set: { description: "A new description", updatedAt: expect.any(Date) },
      })
    )
  })

  it("turns direct Neon batch uniqueness errors into series-order validation without invalidating cache", async () => {
    const db = database([[{ id: ID, slug: payload.slug, publishedAt: null }]])
    db.batch.mockRejectedValue({ code: "23505", constraint: "idx_posts_series_order_unique" })
    expect(
      await savePost({ ...payload, id: ID, tags: ["new"], seriesTitle: "A Series", seriesOrder: 2 })
    ).toMatchObject({
      ok: false,
      errors: { seriesOrder: ["Part 2 of that series already exists."] },
    })
    expect(mocks.updateTag).not.toHaveBeenCalled()
  })

  it("does not report success or invalidate cache when the atomic write fails", async () => {
    const db = database([[{ id: ID, slug: payload.slug, publishedAt: null }]])
    db.batch.mockRejectedValue(new Error("Database unavailable"))
    await expect(savePost({ ...payload, id: ID, tags: ["new"] })).rejects.toThrow(
      "Database unavailable"
    )
    expect(mocks.updateTag).not.toHaveBeenCalled()
  })
})

describe("other post mutations", () => {
  it("deletes with RETURNING and invalidates the article without a preliminary body read", async () => {
    const db = database([])
    expect(await deletePost(ID)).toEqual({ ok: true })
    expect(db.select).not.toHaveBeenCalled()
    expect(db.delete).toHaveBeenCalledWith(schema.posts)
    expect(db.returning).toHaveBeenCalledWith({ slug: schema.posts.slug })
    expect(mocks.updateTag.mock.calls).toEqual([["posts"], ["post:new-title"]])
  })

  it("does not invalidate cache if a deleted post no longer exists", async () => {
    const db = database([])
    db.returning.mockResolvedValue([])
    expect(await deletePost(ID)).toMatchObject({ ok: false })
    expect(mocks.updateTag).not.toHaveBeenCalled()
  })

  it("checks body presence without loading its JSON before publishing", async () => {
    const db = database([
      [
        {
          slug: payload.slug,
          publishedAt: null,
          hasContent: false,
          coverUrl: null,
          coverAlt: null,
        },
      ],
    ])
    expect(await setPostStatus(ID, "published")).toMatchObject({ ok: false })
    expect(db.select).toHaveBeenCalledWith({
      slug: schema.posts.slug,
      publishedAt: schema.posts.publishedAt,
      hasContent: expect.anything(),
      coverUrl: schema.posts.coverUrl,
      coverAlt: schema.posts.coverAlt,
    })
    expect(db.update).not.toHaveBeenCalled()
    expect(mocks.updateTag).not.toHaveBeenCalled()
  })

  it("rejects malformed IDs before making status queries", async () => {
    const db = database([])
    expect(await setPostStatus("invalid", "published")).toMatchObject({ ok: false })
    expect(db.select).not.toHaveBeenCalled()
  })
})
