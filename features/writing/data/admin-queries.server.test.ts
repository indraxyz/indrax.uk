import { drizzle } from "drizzle-orm/neon-http"
import { beforeEach, expect, it, vi } from "vitest"

import {
  defaultAdminArchiveOptions,
  parseAdminArchiveOptions,
} from "@/features/writing/utils/admin-archive-options"
import * as schema from "@/lib/db/schema"

const mocks = vi.hoisted(() => ({ requireAuthor: vi.fn(), getDb: vi.fn() }))
vi.mock("@/lib/auth-guard.server", () => ({ requireAuthor: mocks.requireAuthor }))
vi.mock("@/lib/db/index.server", async () => ({
  getDb: mocks.getDb,
  schema: await import("@/lib/db/schema"),
}))

import {
  getAdminArchivePosts,
  getAdminTagsInUse,
  getAdminOverview,
  getPostForEdit,
  listAllPosts,
} from "./admin-queries.server"

const ID = "550e8400-e29b-41d4-a716-446655440000"
const date = "2026-10-08T00:00:00.000Z"
const tags = [
  { id: "tag-z", name: "Zebra", slug: "zebra" },
  { id: "tag-a", name: "Apple", slug: "apple" },
]

function database(rows: unknown[][]) {
  // Retain the real Drizzle SQL builder and relational row mapping. Only the
  // Neon HTTP request is replaced, so these count actual database round trips.
  const query = vi.fn(async () => ({ rows }))
  const db = drizzle({ client: { query } as never, schema })
  mocks.getDb.mockReturnValue(db)
  return query
}

beforeEach(() => vi.resetAllMocks())

it("guards both reads before touching the database", async () => {
  mocks.requireAuthor.mockRejectedValue(new Error("Not authorised"))
  await expect(getAdminOverview()).rejects.toThrow("Not authorised")
  await expect(listAllPosts()).rejects.toThrow("Not authorised")
  await expect(getAdminArchivePosts()).rejects.toThrow("Not authorised")
  await expect(getAdminTagsInUse()).rejects.toThrow("Not authorised")
  await expect(getPostForEdit(ID)).rejects.toThrow("Not authorised")
  expect(mocks.getDb).not.toHaveBeenCalled()
})

it("rejects malformed edit identifiers without a SQL request", async () => {
  const query = database([])
  expect(await getPostForEdit("not-a-uuid")).toBeNull()
  expect(query).not.toHaveBeenCalled()
})

it("reads admin summaries and tags in one request without article bodies", async () => {
  const query = database([
    [ID, "draft", "Draft", "draft", null, date, tags.map((tag) => [Object.values(tag)])],
  ])
  const result = await listAllPosts()
  expect(query).toHaveBeenCalledTimes(1)
  const sql = (query.mock.calls[0] as unknown as [string])[0]
  expect(sql).toContain('"post_tags"')
  expect(sql).toContain('"tags"')
  expect(sql).not.toContain('"content_json"')
  expect(result).toEqual([
    {
      id: ID,
      slug: "draft",
      title: "Draft",
      status: "draft",
      publishedAt: null,
      updatedAt: date,
      tags: [tags[1], tags[0]],
    },
  ])
})

it("reads an edit body, sorted tags and series together in one request", async () => {
  const content = { type: "doc", content: [] }
  const query = database([
    [
      ID,
      "draft",
      "Draft",
      "draft",
      "Excerpt",
      content,
      null,
      null,
      null,
      date,
      1,
      tags.map((tag) => [Object.values(tag)]),
      ["Series title", "Series description"],
    ],
  ])
  expect(await getPostForEdit(ID)).toEqual({
    id: ID,
    slug: "draft",
    title: "Draft",
    status: "draft",
    excerpt: "Excerpt",
    content,
    coverUrl: null,
    coverAlt: null,
    publishedAt: null,
    updatedAt: date,
    tags: [tags[1], tags[0]],
    seriesTitle: "Series title",
    seriesDescription: "Series description",
    seriesOrder: 1,
  })
  expect(query).toHaveBeenCalledTimes(1)
  const sql = (query.mock.calls[0] as unknown as [string])[0]
  expect(sql).toContain('"series"')
  expect(sql).not.toContain('"search_vector"')
})

it("preserves missing-post results and standalone posts without tags", async () => {
  const query = database([])
  expect(await getPostForEdit(ID)).toBeNull()
  query.mockResolvedValueOnce({
    rows: [[ID, "draft", "Draft", "draft", null, null, null, null, null, date, null, [], null]],
  })
  expect(await getPostForEdit(ID)).toMatchObject({
    tags: [],
    seriesTitle: null,
    seriesDescription: null,
    content: null,
  })
})

it("preserves the configured-without-database fallback", async () => {
  mocks.getDb.mockReturnValue(null)
  expect(await listAllPosts()).toEqual([])
  expect(await getPostForEdit(ID)).toBeNull()
})

function overviewDatabase(results: unknown[][][]) {
  // Drizzle prepares the queries, and Neon sends them through one transaction.
  const query = vi.fn((sql: string, params: unknown[]) => ({ sql, params }))
  const transaction = vi.fn(async () => results.map((rows) => ({ rows })))
  mocks.getDb.mockReturnValue(drizzle({ client: { query, transaction } as never, schema }))
  return { query, transaction }
}

it("reads overview counts and only the newest draft in one HTTP transaction", async () => {
  const { query, transaction } = overviewDatabase([[["9", "4", "3", "2"]], [[ID, "Newest draft"]]])
  expect(await getAdminOverview()).toEqual({
    total: 9,
    published: 4,
    drafts: 3,
    archived: 2,
    latestDraft: { id: ID, title: "Newest draft" },
  })
  expect(transaction).toHaveBeenCalledTimes(1)
  const statements = query.mock.calls.map(([sql]) => sql)
  expect(statements).toHaveLength(2)
  expect(statements[0]).toContain("count(*) filter")
  expect(statements[1]).toContain('order by "posts"."updated_at" desc limit')
  expect(query.mock.calls[1][1]).toEqual(["draft", 1])
  for (const sql of statements) {
    expect(sql).not.toContain('"post_tags"')
    expect(sql).not.toContain('"content_json"')
  }
})

it("returns zero counts and no draft for an empty overview", async () => {
  overviewDatabase([[["0", "0", "0", "0"]], []])
  expect(await getAdminOverview()).toEqual({
    total: 0,
    published: 0,
    drafts: 0,
    archived: 0,
    latestDraft: null,
  })
})

it("provides an empty overview when the database is unconfigured", async () => {
  mocks.getDb.mockReturnValue(null)
  expect(await getAdminOverview()).toEqual({
    total: 0,
    published: 0,
    drafts: 0,
    archived: 0,
    latestDraft: null,
  })
})

function archiveDatabase(results: unknown[][][]) {
  const query = vi.fn().mockImplementation(() => Promise.resolve({ rows: results.shift() ?? [] }))
  const transaction = vi
    .fn()
    .mockImplementation((queries: Promise<unknown>[]) => Promise.all(queries))
  mocks.getDb.mockReturnValue(drizzle({ client: { query, transaction } as never, schema }))
  return { query, transaction }
}
const adminCard = [ID, "draft", "Draft", "draft", null, date, tags]

it("batches private archive count and summaries, includes drafts and excludes bodies", async () => {
  const db = archiveDatabase([[[11]], [adminCard]])
  expect(await getAdminArchivePosts({ ...defaultAdminArchiveOptions, page: 2 })).toEqual({
    total: 11,
    page: 2,
    pageCount: 2,
    posts: [expect.objectContaining({ id: ID, status: "draft", tags, publishedAt: null })],
  })
  expect(mocks.requireAuthor).toHaveBeenCalledOnce()
  expect(db.transaction).toHaveBeenCalledOnce()
  expect(db.query).toHaveBeenCalledTimes(2)
  const statement = db.query.mock.calls[1][0]
  expect(statement).not.toContain('"content_json"')
  expect(statement).not.toContain('"status" =')
  expect(statement).toContain('"updated_at" desc')
  expect(statement).toContain('"published_at" desc nulls last')
  expect(statement).toContain('"posts"."id" asc')
})
it("combines authenticated status, fulltext, OR tags, date and reading filters in both SQL statements", async () => {
  const db = archiveDatabase([[[1]], [adminCard]])
  const options = parseAdminArchiveOptions(
    new URLSearchParams(
      "status=archived&q=search&tag=react&tag=postgres&date=custom&from=2026-01-01&to=2026-02-01&duration=medium&sort=relevance"
    )
  )
  await getAdminArchivePosts(options)
  for (const [statement, parameters] of db.query.mock.calls) {
    expect(statement).toContain('"posts"."status" =')
    expect(statement).toContain('"posts"."search_vector" @@')
    expect(statement).toContain('"tags"."slug" in (')
    expect(parameters).toEqual(
      expect.arrayContaining([
        "archived",
        "search",
        "react",
        "postgres",
        5,
        10,
        "2026-01-01T00:00:00.000Z",
        "2026-02-02T00:00:00.000Z",
      ])
    )
  }
  expect(db.query.mock.calls[1][0]).toContain("ts_rank_cd")
})
it("corrects stale admin pages and returns exact total", async () => {
  const db = archiveDatabase([[[11]], [], [adminCard]])
  expect(await getAdminArchivePosts({ ...defaultAdminArchiveOptions, page: 999 })).toMatchObject({
    total: 11,
    page: 2,
    pageCount: 2,
    posts: [expect.anything()],
  })
  expect(db.query).toHaveBeenCalledTimes(3)
})
it("returns all-status tag counts without selecting private content", async () => {
  const query = database([["tag-id", "Tag", "tag", 7]])
  expect(await getAdminTagsInUse()).toEqual([
    { id: "tag-id", name: "Tag", slug: "tag", postCount: 7 },
  ])
  expect(mocks.requireAuthor).toHaveBeenCalledOnce()
  const statement = (query.mock.calls[0] as unknown as [string])[0]
  expect(statement).not.toContain('"content_json"')
  expect(statement).not.toContain("status")
})
it("keeps admin archive and tag fallbacks guarded when the database is unconfigured", async () => {
  mocks.getDb.mockReturnValue(null)
  expect(await getAdminArchivePosts()).toEqual({ total: 0, page: 1, pageCount: 0, posts: [] })
  expect(await getAdminTagsInUse()).toEqual([])
  expect(mocks.requireAuthor).toHaveBeenCalledTimes(2)
})

it.each([
  ["search", 201, 20],
  ["", 10001, 1000],
])(
  "caps private navigable pages for query %s while preserving total %s",
  async (q, total, limit) => {
    const db = archiveDatabase([[[total]], [adminCard]])
    expect(
      await getAdminArchivePosts({ ...defaultAdminArchiveOptions, q, page: limit + 1 })
    ).toMatchObject({ total, page: limit, pageCount: limit })
    expect(db.query).toHaveBeenCalledTimes(2)
  }
)
