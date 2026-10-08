import { drizzle } from "drizzle-orm/neon-http"
import { beforeEach, expect, it, vi } from "vitest"

import * as schema from "@/lib/db/schema"

const mocks = vi.hoisted(() => ({ requireAuthor: vi.fn(), getDb: vi.fn() }))
vi.mock("@/lib/auth-guard", () => ({ requireAuthor: mocks.requireAuthor }))
vi.mock("@/lib/db", async () => ({ getDb: mocks.getDb, schema: await import("@/lib/db/schema") }))

import { getAdminOverview, getPostForEdit, listAllPosts } from "./admin-queries"

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
