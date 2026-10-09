import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), log: vi.fn() }))
vi.mock("@/lib/db", async () => ({
  getDb: mocks.getDb,
  schema: await import("@/lib/db/schema"),
}))
vi.mock("@/lib/cache.server", () => ({
  cachedRead: (_key: string, _tags: string[], read: () => Promise<unknown>) => read(),
}))
vi.mock("@/lib/observability", () => ({ logServerError: mocks.log }))

import {
  getFeedPosts,
  getPostsByTag,
  getPostBySlug,
  getPostForPreview,
  getPublishedPosts,
  getRecentPosts,
  getRelatedPosts,
  getSeriesBySlug,
  searchPosts,
} from "./queries"

import { WRITING_CONFIG } from "@/features/writing/config"

const tag = { id: "tag-id", name: "Database", slug: "database" }
const date = "2026-10-08T00:00:00.000Z"
// Driver responses are array-mode rows; real Drizzle maps columns and dates.
const summaryRow = ["post-id", "article", "Article", "Excerpt", null, null, date, date, 1, [tag]]

function database(results: unknown[][][]) {
  const query = vi.fn().mockImplementation(() => Promise.resolve({ rows: results.shift() ?? [] }))
  const transaction = vi
    .fn()
    .mockImplementation((queries: Promise<unknown>[]) => Promise.all(queries))
  const client = { query, transaction } as unknown as ReturnType<typeof neon>
  mocks.getDb.mockReturnValue(drizzle(client))
  return { query, transaction }
}

beforeEach(() => vi.resetAllMocks())

describe("public database round trips", () => {
  it.each([
    ["recent", () => getRecentPosts(3)],
    ["feed", () => getFeedPosts()],
    ["related", () => getRelatedPosts("source-id")],
  ])("reads %s cards and their ordered tags in one query", async (_, read) => {
    const db = database([[summaryRow]])
    const posts = await read()
    expect(posts).toEqual([
      expect.objectContaining({ tags: [tag], publishedAt: date, updatedAt: date }),
    ])
    expect(db.query).toHaveBeenCalledTimes(1)
    const [statement] = db.query.mock.calls[0]
    expect(statement).toContain("jsonb_agg")
    expect(statement).toContain('order by "tags"."name"')
    expect(statement).toContain('"posts"."content_json" is not null')
    expect(statement).toContain('"posts"."published_at" is not null')
    expect(statement).toContain('"posts"."status" =')
    // Cards test body presence, but never transfer it from the database.
    expect(statement.split(" from ")[0]).not.toContain('"posts"."content_json"')
  })

  it("batches archive count and tagged cards in one transaction", async () => {
    const db = database([[[WRITING_CONFIG.pageSize + 1]], [summaryRow]])
    expect(await getPublishedPosts(2)).toMatchObject({
      page: 2,
      pageCount: 2,
      posts: [expect.objectContaining({ tags: [tag] })],
    })
    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(db.query).toHaveBeenCalledTimes(2)
    expect(db.query.mock.calls[1][1]).toContain(WRITING_CONFIG.pageSize)
  })

  it("corrects a stale out-of-range page to the last real page", async () => {
    const db = database([[[WRITING_CONFIG.pageSize + 1]], [], [summaryRow]])
    expect(await getPublishedPosts(9)).toMatchObject({
      page: 2,
      pageCount: 2,
      posts: [expect.anything()],
    })
    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(db.query).toHaveBeenCalledTimes(3)
    expect(db.query.mock.calls[2][1]).toContain(WRITING_CONFIG.pageSize)
  })

  it("returns page one for an empty archive without a corrective query", async () => {
    const db = database([[[0]], []])
    expect(await getPublishedPosts(9)).toEqual({ page: 1, pageCount: 0, posts: [] })
    expect(db.query).toHaveBeenCalledTimes(2)
  })

  it("keeps tag slugs parameterized in both count and cards", async () => {
    const db = database([[[1]], [summaryRow]])
    await getPostsByTag("database")
    expect(db.transaction).toHaveBeenCalledTimes(1)
    for (const [statement, parameters] of db.query.mock.calls) {
      expect(statement).toContain("exists")
      expect(statement).toContain('"tags"."id" = "post_tags"."tag_id"')
      expect(statement).toContain('"post_tags"."post_id" = "posts"."id"')
      expect(statement).not.toContain("'database'")
      expect(parameters).toContain("database")
    }
  })

  it("batches search count and cards while retaining proximity ranking", async () => {
    const db = database([[[1]], [summaryRow]])
    expect(await searchPosts("database")).toMatchObject({ query: "database", pageCount: 1 })
    expect(db.transaction).toHaveBeenCalledTimes(1)
    expect(db.query.mock.calls[1][0]).toContain("ts_rank_cd")
    expect(db.query.mock.calls[1][1]).toContain("database")
  })

  it.each([
    ["public article", getPostBySlug, "published"],
    ["token-guarded preview", getPostForPreview, "draft"],
  ])("reads %s and tags once without duplicating its body", async (_, read, status) => {
    const content = { type: "doc", content: [] }
    const db = database([[[...summaryRow, content, status, 0, null]]])
    const post = await read("article")
    expect(post).toMatchObject({ content, tags: [tag], status, seriesContext: null })
    expect(post).not.toHaveProperty("contentJson")
    expect(post).not.toHaveProperty("searchVector")
    expect(db.query).toHaveBeenCalledTimes(1)
    expect(db.query.mock.calls[0][0]).not.toContain("search_vector")
  })

  it("decodes JSON text tags without another query", async () => {
    const db = database([[summaryRow.slice(0, -1).concat(JSON.stringify([tag]))]])
    expect(await getRecentPosts(1)).toEqual([expect.objectContaining({ tags: [tag] })])
    expect(db.query).toHaveBeenCalledTimes(1)
  })

  it("reads series metadata and published parts in one left join", async () => {
    const db = database([
      [["series-id", "series", "Series", null, "article", "Article", null, "Excerpt", 1, date]],
    ])
    expect(await getSeriesBySlug("series")).toMatchObject({
      series: { id: "series-id", slug: "series" },
      parts: [{ slug: "article", order: 1, publishedAt: date }],
    })
    expect(db.query).toHaveBeenCalledTimes(1)
    expect(db.query.mock.calls[0][0]).toContain("left join")
    expect(db.query.mock.calls[0][0]).toContain('"posts"."content_json" is not null')
  })

  it("preserves a series with no published parts as an empty series", async () => {
    database([[["series-id", "series", "Series", null, null, null, null, null, null, null]]])
    expect(await getSeriesBySlug("series")).toMatchObject({
      series: { id: "series-id" },
      parts: [],
    })
  })

  it("returns null for a missing series", async () => {
    database([[]])
    expect(await getSeriesBySlug("missing")).toBeNull()
  })

  it("uses the existing safe fallback when a batch fails", async () => {
    const db = database([])
    db.transaction.mockRejectedValue(new Error("database offline"))
    expect(await getPublishedPosts()).toEqual({ page: 1, pageCount: 0, posts: [] })
    expect(mocks.log).toHaveBeenCalledWith(expect.any(Error), {
      scope: "writing.getPublishedPosts",
    })
  })
})
