import { randomUUID } from "node:crypto"

import { neonConfig } from "@neondatabase/serverless"
import { desc, eq, inArray, sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest"

// Test actual SQL and HTTP batching against local Postgres. Authentication and
// Application caching are covered separately; neither participates in the SQL budget.
vi.mock("@/lib/auth-guard", () => ({ requireAuthor: vi.fn().mockResolvedValue({ id: "author" }) }))
vi.mock("@/lib/cache.server", () => ({
  cachedRead: (_key: string, _tags: string[], fn: () => unknown) => fn(),
  invalidateTags: vi.fn(),
}))

import {
  getAdminOverview,
  getPostForEdit,
  listAllPosts,
} from "@/features/writing/data/admin-queries"
import { savePost } from "@/features/writing/data/mutations"
import {
  getPostBySlug,
  getPostsByTag,
  getRecentPosts,
  getSeriesBySlug,
  searchPosts,
} from "@/features/writing/data/queries"
import { getDb, schema } from "@/lib/db"

const prefix = `latency-${randomUUID().slice(0, 18)}`
const tagName = `${prefix}-tag`
const seriesTitle = `${prefix}-series`
const postIds: string[] = Array.from({ length: 13 }, () => randomUUID())
const seriesId = randomUUID()
const tagId = randomUUID()
let calls = 0
let batches = 0
let afterNextRead: (() => Promise<void>) | undefined
const originalFetch = neonConfig.fetchFunction
const db = getDb()!
const body = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Latencyfixture body." }] }],
}

beforeAll(async () => {
  neonConfig.fetchFunction = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ) => {
    calls++
    if (init?.body && JSON.parse(String(init.body)).queries) batches++
    const response = await fetch(input, init)
    const nextRead = afterNextRead
    if (nextRead && init?.body && !JSON.parse(String(init.body)).queries) {
      afterNextRead = undefined
      await nextRead()
    }
    return response
  }
  await db.insert(schema.tags).values({ id: tagId, name: tagName, slug: tagName })
  await db.insert(schema.series).values({ id: seriesId, title: seriesTitle, slug: seriesTitle })
  await db.insert(schema.posts).values(
    postIds.map((id, index) => ({
      id,
      slug: `${prefix}-${index}`,
      title: `Latencyfixture ${index}`,
      status: index === 12 ? ("draft" as const) : ("published" as const),
      publishedAt: index === 12 ? null : new Date(Date.UTC(2026, 0, index + 1)),
      contentJson: body,
      excerpt: "Original excerpt",
      seriesId: index < 2 ? seriesId : null,
      seriesOrder: index < 2 ? index + 1 : null,
    }))
  )
  await db.insert(schema.postTags).values(postIds.map((postId) => ({ postId, tagId })))
})

beforeEach(() => {
  calls = 0
  batches = 0
  afterNextRead = undefined
})

afterAll(async () => {
  try {
    await db.delete(schema.posts).where(inArray(schema.posts.id, postIds))
    await db.delete(schema.series).where(eq(schema.series.id, seriesId))
    await db.delete(schema.tags).where(inArray(schema.tags.slug, [tagName, `${prefix}-new-tag`]))
  } finally {
    neonConfig.fetchFunction = originalFetch
  }
})

it("returns a tagged page in one HTTP batch and clamps an oversized page correctly", async () => {
  const first = await getPostsByTag(tagName)
  expect(calls).toBe(1)
  expect(first).toMatchObject({ page: 1, pageCount: 2 })
  expect(first.posts).toHaveLength(10)
  expect(first.posts.flatMap((post) => post.tags.map((tag) => tag.slug))).toEqual(
    Array(10).fill(tagName)
  )
  expect(first.posts.map((post) => post.id)).not.toContain(postIds[12])

  calls = 0
  const last = await getPostsByTag(tagName, 999)
  expect(calls).toBeLessThanOrEqual(2)
  expect(last).toMatchObject({ page: 2, pageCount: 2 })
  expect(last.posts).toHaveLength(2)
})

it("returns recent cards with tags in one request and never includes a draft body", async () => {
  const recent = await getRecentPosts(100)
  expect(calls).toBe(1)
  expect(recent.some((post) => post.id === postIds[0])).toBe(true)
  expect(recent.some((post) => post.id === postIds[12])).toBe(false)
  for (const post of recent) expect(post).not.toHaveProperty("content")
})

it("searches and counts tagged public results in one batch", async () => {
  const results = await searchPosts("Latencyfixture")
  expect(calls).toBe(1)
  expect(results.posts).toHaveLength(10)
  expect(results.pageCount).toBe(2)
  expect(results.posts.every((post) => post.tags.some((tag) => tag.slug === tagName))).toBe(true)
})

it("loads an admin edit and listing in one request each, retaining drafts and series", async () => {
  const post = await getPostForEdit(postIds[0])
  expect(calls).toBe(1)
  expect(post).toMatchObject({ content: body, seriesTitle, tags: [{ id: tagId, slug: tagName }] })
  calls = 0
  const posts = await listAllPosts()
  expect(calls).toBe(1)
  expect(posts.find((entry) => entry.id === postIds[12])?.status).toBe("draft")
})

it("returns accurate admin overview counts and newest draft in one HTTP batch", async () => {
  const rows = await db
    .select({ id: schema.posts.id, title: schema.posts.title, status: schema.posts.status })
    .from(schema.posts)
    .orderBy(desc(schema.posts.updatedAt))
  calls = 0
  batches = 0
  const overview = await getAdminOverview()
  expect(calls).toBe(1)
  expect(batches).toBe(1)
  const draft = rows.find((row) => row.status === "draft")
  expect(overview).toEqual({
    total: rows.length,
    published: rows.filter((row) => row.status === "published").length,
    drafts: rows.filter((row) => row.status === "draft").length,
    archived: rows.filter((row) => row.status === "archived").length,
    latestDraft: draft ? { id: draft.id, title: draft.title } : null,
  })
})

it("loads public series/article navigation without exposing draft content", async () => {
  const series = await getSeriesBySlug(seriesTitle)
  expect(calls).toBeLessThanOrEqual(2)
  expect(series?.parts).toHaveLength(2)
  calls = 0
  const article = await getPostBySlug(`${prefix}-0`)
  expect(article?.seriesContext).toMatchObject({ position: 1, total: 2 })
  expect(article?.tags).toMatchObject([{ id: tagId, slug: tagName }])
  expect(await getPostBySlug(`${prefix}-12`)).toBeNull()
})

const savePayload = {
  id: postIds[2],
  title: "Latencyfixture changed",
  slug: `${prefix}-2`,
  status: "published" as const,
  tags: [tagName],
  excerpt: "Updated excerpt",
  content: body,
}

it("saves unchanged tag membership with two requests and preserves the original tag name", async () => {
  const tuple = async () =>
    db
      .select({ tuple: sql<string>`ctid::text` })
      .from(schema.postTags)
      .where(eq(schema.postTags.postId, postIds[2]))
  const before = await tuple()
  calls = 0
  expect(await savePost({ ...savePayload, tags: [tagName.toUpperCase(), tagName] })).toMatchObject({
    ok: true,
  })
  expect(calls).toBe(2)
  expect(batches).toBe(1)
  expect(await tuple()).toEqual(before)
  const saved = await getPostForEdit(postIds[2])
  expect(saved?.excerpt).toBe("Updated excerpt")
  expect(saved?.tags).toEqual([{ id: tagId, name: tagName, slug: tagName }])
})

it("synchronizes the final submitted tags after another save changes them between read and write", async () => {
  const original = { ...savePayload, id: postIds[3], slug: `${prefix}-3`, tags: [tagName] }
  afterNextRead = async () => {
    expect(
      await savePost({ ...original, tags: [`${prefix}-new-tag`], excerpt: "Concurrent edit" })
    ).toMatchObject({ ok: true })
  }
  expect(await savePost({ ...original, excerpt: "Final edit" })).toMatchObject({ ok: true })
  expect(calls).toBe(4)
  expect(batches).toBe(2)
  expect(await getPostForEdit(postIds[3])).toMatchObject({
    excerpt: "Final edit",
    tags: [{ slug: tagName }],
  })
})

it("atomically replaces tags, resolving both existing and newly inserted tags", async () => {
  expect(
    await savePost({ ...savePayload, tags: [tagName, `${prefix}-new-tag`, `${prefix}-new-tag`] })
  ).toMatchObject({ ok: true })
  expect(calls).toBe(2)
  expect(batches).toBe(1)
  const saved = await getPostForEdit(postIds[2])
  expect(saved?.tags.map((tag) => tag.slug).sort()).toEqual([`${prefix}-new-tag`, tagName].sort())
})

it("rolls back the post and tag membership when a series position conflicts", async () => {
  const before = await getPostForEdit(postIds[2])
  calls = 0
  const result = await savePost({
    ...savePayload,
    excerpt: "Must not be saved",
    tags: [],
    seriesTitle,
    seriesOrder: 1,
  })
  expect(result).toMatchObject({ ok: false, errors: { seriesOrder: expect.any(Array) } })
  const after = await getPostForEdit(postIds[2])
  expect(after?.excerpt).toBe(before?.excerpt)
  expect(after?.tags).toEqual(before?.tags)
  expect(after?.seriesTitle).toBeNull()
})

it("clears tag membership without deleting shared tags", async () => {
  expect(await savePost({ ...savePayload, tags: [] })).toMatchObject({ ok: true })
  expect(calls).toBe(2)
  expect(batches).toBe(1)
  expect((await getPostForEdit(postIds[2]))?.tags).toEqual([])
  expect((await getPostForEdit(postIds[0]))?.tags).toEqual([
    { id: tagId, name: tagName, slug: tagName },
  ])
})

it("preserves series descriptions on empty-input saves and keeps the original title", async () => {
  const payload = {
    ...savePayload,
    id: postIds[0],
    slug: `${prefix}-0`,
    seriesTitle: seriesTitle.toUpperCase(),
    seriesOrder: 1,
  }
  expect(
    await savePost({ ...payload, seriesDescription: "Shared series description" })
  ).toMatchObject({
    ok: true,
  })
  expect(calls).toBe(3)
  expect(await savePost({ ...payload, seriesDescription: "  " })).toMatchObject({ ok: true })
  expect(await getPostForEdit(postIds[0])).toMatchObject({
    seriesTitle,
    seriesDescription: "Shared series description",
  })
})

it("creates a post and its new tag joins in one write batch", async () => {
  const result = await savePost({
    ...savePayload,
    id: undefined,
    slug: `${prefix}-created`,
    status: "draft",
    tags: [`${prefix}-new-tag`],
  })
  expect(result).toMatchObject({ ok: true, postId: expect.any(String) })
  if (result.postId) postIds.push(result.postId)
  expect(calls).toBe(2)
  expect(batches).toBe(1)
  expect((await getPostForEdit(result.postId!))?.tags).toMatchObject([
    { slug: `${prefix}-new-tag` },
  ])
})
