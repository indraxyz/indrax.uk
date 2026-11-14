import { randomUUID } from "node:crypto"
import { neonConfig } from "@neondatabase/serverless"
import { inArray } from "drizzle-orm"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import {
  getArchivePosts,
  getFeedPosts,
  getPostBySlug,
  getPostForPreview,
  getPostsByTag,
  getPublishedPosts,
  getPublishedSlugs,
  getRecentPosts,
  getRelatedPosts,
  getSeriesBySlug,
  getSeriesSlugs,
  getTagsInUse,
  searchPosts,
} from "@/features/writing/data/queries.server"
import { defaultArchiveOptions } from "@/features/writing/utils/archive-options"
import { getDb, schema } from "@/lib/db/index.server"
import { runWithRequest } from "@/lib/runtime.server"
import { GET as viewBeacon } from "@/lib/views.server"

const db = getDb()!
const prefix = `publication-${randomUUID()}`
const searchTerm = `publication${randomUUID().replaceAll("-", "")}`
const ids = Array.from({ length: 8 }, () => randomUUID())
const tag = { id: randomUUID(), slug: `${prefix}-tag`, name: prefix }
const futureTag = { id: randomUUID(), slug: `${prefix}-future-tag`, name: `${prefix} future` }
const series = [
  { id: randomUUID(), slug: `${prefix}-series`, title: "Publication series" },
  { id: randomUUID(), slug: `${prefix}-future-series`, title: "Future-only series" },
]
const boundary = Date.parse("2030-01-01T12:00:00.000Z")
const slug = (index: number) => `${prefix}-${index}`
const contentJson = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: searchTerm }] }],
}

beforeAll(async () => {
  await db.insert(schema.tags).values([tag, futureTag])
  await db.insert(schema.series).values(series)
  await db.insert(schema.posts).values(
    ids.map((id, index) => ({
      id,
      slug: slug(index),
      title: `${searchTerm} part ${index}`,
      status:
        index === 2
          ? ("draft" as const)
          : index === 3
            ? ("archived" as const)
            : ("published" as const),
      publishedAt:
        index === 4
          ? null
          : new Date(
              index === 1 ? boundary : index === 6 ? boundary + 86_400_000 : boundary - 1_000
            ),
      contentJson: index === 5 ? null : contentJson,
      readingTime: 1,
      seriesId: index === 6 ? series[1].id : series[0].id,
      seriesOrder: index + 1,
    }))
  )
  await db
    .insert(schema.postTags)
    .values([
      ...ids.map((postId) => ({ postId, tagId: tag.id })),
      { postId: ids[6], tagId: futureTag.id },
    ])
})

beforeEach(() => {
  // Keep network timers real; only publication predicates and cache timestamps are controlled.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(boundary - 1)
})
afterEach(() => vi.useRealTimers())
afterAll(async () => {
  await db.delete(schema.posts).where(inArray(schema.posts.id, ids))
  await db.delete(schema.tags).where(inArray(schema.tags.id, [tag.id, futureTag.id]))
  await db.delete(schema.series).where(
    inArray(
      schema.series.id,
      series.map(({ id }) => id)
    )
  )
})

function fixtureSlugs(rows: { slug: string }[]) {
  return rows
    .filter((row) => row.slug.startsWith(prefix))
    .map(({ slug }) => slug)
    .sort()
}

function cacheBindings() {
  const values = new Map<string, string>()
  const kv = {
    get: vi.fn(async (key: string) => (values.has(key) ? JSON.parse(values.get(key)!) : null)),
    put: vi.fn(async (key: string, value: string) => {
      values.set(key, value)
    }),
  }
  const revisions = {
    prepare: vi.fn(() => ({
      bind: () => ({
        first: async () => null,
        all: async () => ({ success: true, results: [], meta: { rows_read: 0 } }),
      }),
    })),
  }
  const env = { CACHE_KV: kv, APP_D1: revisions }
  const request = <T>(read: () => T) =>
    runWithRequest(new Request("https://publication.example/"), env, undefined, read)
  return { values, kv, request }
}

describe("publication eligibility against PostgreSQL", () => {
  it.each([1, 2, 3, 4, 5, 6])(
    "keeps unreadable detail %i private without changing signed-preview reads",
    async (index) => {
      expect(await getPostBySlug(slug(index))).toBeNull()
      const preview = await getPostForPreview(slug(index))
      if (index === 5) expect(preview).toBeNull()
      else {
        expect(preview).toMatchObject({ id: ids[index], content: contentJson })
        expect(preview?.seriesContext).toBeNull()
      }
    }
  )

  it("excludes hidden fixtures from every public listing and count", async () => {
    const expected = [slug(0), slug(7)].sort()
    const results = await Promise.all([
      getPublishedPosts(),
      getArchivePosts(),
      getArchivePosts({ ...defaultArchiveOptions, tags: [tag.slug] }),
      getPostsByTag(tag.slug),
      searchPosts(searchTerm),
    ])
    for (const result of results) expect(fixtureSlugs(result.posts)).toEqual(expected)
    expect(fixtureSlugs(await getRecentPosts(100))).toEqual(expected)
    expect(fixtureSlugs(await getFeedPosts())).toEqual(expected)
    expect(fixtureSlugs(await getPublishedSlugs())).toEqual(expected)
    expect(fixtureSlugs(await getRelatedPosts(ids[0], 100))).toEqual([slug(7)])
    const tags = await getTagsInUse()
    expect(tags.find(({ id }) => id === tag.id)?.postCount).toBe(2)
    expect(tags.find(({ id }) => id === futureTag.id)).toBeUndefined()
    expect((await getPostsByTag(futureTag.slug)).posts).toEqual([])
  })

  it("keeps future series parts unpublished in context while preserving intentional titles", async () => {
    const post = await getPostBySlug(slug(0))
    const context = post!.seriesContext!
    expect(context.total).toBe(2)
    expect(context.position).toBe(1)
    expect(context.previous).toBeNull()
    expect(context.next).toMatchObject({ slug: slug(7), published: true })
    expect(context.parts.find((part) => part.slug === slug(1))).toMatchObject({
      title: `${searchTerm} part 1`,
      published: false,
    })
    for (const index of [1, 2, 3, 4, 5])
      expect(context.parts.find((part) => part.slug === slug(index))?.published).toBe(false)
    expect(fixtureSlugs((await getSeriesBySlug(series[0].slug))!.parts)).toEqual(
      [slug(0), slug(7)].sort()
    )
    expect((await getSeriesBySlug(series[1].slug))!.parts).toEqual([])
    const listed = (await getSeriesSlugs()).map(({ slug }) => slug)
    expect(listed).toContain(series[0].slug)
    expect(listed).not.toContain(series[1].slug)
  })

  it("becomes readable at the exact inclusive boundary without a module reload or sleep", async () => {
    expect(await getPostBySlug(slug(1))).toBeNull()
    vi.setSystemTime(boundary)
    expect(await getPostBySlug(slug(1))).toMatchObject({ id: ids[1] })
    const expected = [slug(0), slug(1), slug(7)].sort()
    expect(
      fixtureSlugs((await getArchivePosts({ ...defaultArchiveOptions, tags: [tag.slug] })).posts)
    ).toEqual(expected)
    expect(fixtureSlugs((await getSeriesBySlug(series[0].slug))!.parts)).toEqual(expected)
    expect((await getPostBySlug(slug(0)))?.seriesContext?.next).toMatchObject({
      slug: slug(1),
      published: true,
    })
  })

  it("counts views only for currently readable posts without exposing hidden status", async () => {
    const pixels: number[][] = []
    for (let index = 0; index < ids.length; index++) {
      const response = await viewBeacon(new Request("https://publication.example/beacon"), {
        params: Promise.resolve({ slug: slug(index) }),
      })
      expect(response.status).toBe(200)
      expect(response.headers.get("cache-control")).toBe("no-store, no-cache, must-revalidate")
      pixels.push([...new Uint8Array(await response.arrayBuffer())])
    }
    for (const pixel of pixels) expect(pixel).toEqual(pixels[0])
    const counts = await db
      .select({ id: schema.posts.id, views: schema.posts.viewCount })
      .from(schema.posts)
      .where(inArray(schema.posts.id, ids))
    for (const row of counts) expect(row.views).toBe(row.id === ids[0] || row.id === ids[7] ? 1 : 0)
  })

  it("keeps ordinary cache entries warm for an hour without minute polling", async () => {
    const start = boundary + 2 * 86_400_000
    vi.setSystemTime(start)
    const { request, kv } = cacheBindings()
    const previousFetch = neonConfig.fetchFunction
    let calls = 0
    neonConfig.fetchFunction = (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1]
    ) => {
      calls++
      return fetch(input, init)
    }
    try {
      const before = await request(() => getArchivePosts())
      expect(calls).toBe(2) // One count/page batch and one parallel deadline lookup.
      vi.setSystemTime(start + 60_000)
      expect(await request(() => getArchivePosts())).toEqual(before)
      expect(calls).toBe(2)
      vi.setSystemTime(start + 3_599_999)
      expect(await request(() => getArchivePosts())).toEqual(before)
      expect(calls).toBe(2)
      expect(kv.put).toHaveBeenCalledTimes(1)
      vi.setSystemTime(start + 3_600_000)
      await request(() => getArchivePosts())
      expect(calls).toBe(4)
    } finally {
      neonConfig.fetchFunction = previousFetch
    }
  })

  it("expires cached absence and default lists at publication without minute-by-minute refresh", async () => {
    const { request, kv } = cacheBindings()
    const absent = await request(() => getPostBySlug(slug(1)))
    const before = await request(() => getArchivePosts())
    expect(absent).toBeNull()
    expect(fixtureSlugs(before.posts)).not.toContain(slug(1))
    const writes = kv.put.mock.calls.length
    vi.setSystemTime(boundary)
    expect(await request(() => getPostBySlug(slug(1)))).toMatchObject({ id: ids[1] })
    expect(fixtureSlugs((await request(() => getArchivePosts())).posts)).toContain(slug(1))
    expect(kv.put).toHaveBeenCalledTimes(writes + 2)
  })
})
