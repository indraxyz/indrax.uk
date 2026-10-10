import { randomUUID } from "node:crypto"
import { neonConfig } from "@neondatabase/serverless"
import { inArray } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const auth = vi.hoisted(() => ({ requireAuthor: vi.fn().mockResolvedValue({ id: "author" }) }))
vi.mock("@/lib/auth-guard.server", () => ({ requireAuthor: auth.requireAuthor }))

vi.mock("@/lib/cache.server", () => ({
  cachedRead: (_key: string, _tags: string[], read: () => unknown) => read(),
}))
import {
  getAdminArchivePosts,
  getAdminTagsInUse,
} from "@/features/writing/data/admin-queries.server"
import { defaultAdminArchiveOptions } from "@/features/writing/utils/admin-archive-options"
import { getArchivePosts, getTagsInUse } from "@/features/writing/data/queries.server"
import {
  defaultArchiveOptions,
  type ArchiveOptions,
} from "@/features/writing/utils/archive-options"
import { getDb, schema } from "@/lib/db/index.server"

const db = getDb()!
const prefix = `archive-${randomUUID()}`
const tags = [
  { id: randomUUID(), slug: `${prefix}-one`, name: `${prefix} one` },
  { id: randomUUID(), slug: `${prefix}-two`, name: `${prefix} two` },
]
const ids = Array.from({ length: 8 }, () => randomUUID())
const originalFetch = neonConfig.fetchFunction
let calls = 0
const body = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Archivefixture sharedword" }] }],
}
const read = (options: Partial<ArchiveOptions> = {}) =>
  getArchivePosts({ ...defaultArchiveOptions, tags: tags.map((tag) => tag.slug), ...options })

beforeAll(async () => {
  await db.insert(schema.tags).values(tags)
  await db.insert(schema.posts).values(
    ids.map((id, index) => ({
      id,
      slug: `${prefix}-${index}`,
      title:
        index === 0
          ? "Zulu Archivefixture"
          : index === 1
            ? "alpha Archivefixture"
            : `Middle Archivefixture ${index}`,
      excerpt: index === 2 ? "Uniqueexcerpt" : null,
      status:
        index === 5
          ? ("draft" as const)
          : index === 6
            ? ("archived" as const)
            : ("published" as const),
      publishedAt:
        index === 7
          ? null
          : new Date(`2026-01-${String(index + 1).padStart(2, "0")}T23:59:59.999Z`),
      contentJson: index === 4 ? null : body,
      readingTime: [4, 5, 10, 11, 2, 1, 1, 1][index],
      viewCount: index === 0 ? 100 : index,
      updatedAt: new Date(`2026-02-${String(8 - index).padStart(2, "0")}T00:00:00Z`),
    }))
  )
  await db
    .insert(schema.postTags)
    .values(
      ids.flatMap((postId, index) =>
        index === 2
          ? tags.map((tag) => ({ postId, tagId: tag.id }))
          : [{ postId, tagId: tags[index % 2].id }]
      )
    )
  neonConfig.fetchFunction = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ) => {
    calls++
    return fetch(input, init)
  }
})
beforeEach(() => {
  calls = 0
})
afterAll(async () => {
  neonConfig.fetchFunction = originalFetch
  await db.delete(schema.posts).where(inArray(schema.posts.id, ids))
  await db.delete(schema.tags).where(
    inArray(
      schema.tags.id,
      tags.map((tag) => tag.id)
    )
  )
})

describe("writing archive against PostgreSQL", () => {
  it("ORs tags without duplicate cards and keeps unpublished/incomplete posts private", async () => {
    const results = await read()
    expect(results.total).toBe(4)
    expect(results.posts.map((post) => post.id)).toEqual(ids.slice(0, 4).reverse())
    expect(calls).toBe(1)
    const counts = await getTagsInUse()
    expect(
      counts
        .filter((tag) => tags.some((fixture) => fixture.id === tag.id))
        .map((tag) => tag.postCount)
        .sort()
    ).toEqual([2, 3])
  })
  it.each([
    ["newest", [3, 2, 1, 0]],
    ["oldest", [0, 1, 2, 3]],
    ["views", [0, 3, 2, 1]],
    ["updated", [0, 1, 2, 3]],
    ["title-asc", [1, 2, 3, 0]],
    ["title-desc", [0, 3, 2, 1]],
  ] as const)("orders %s correctly in one database round trip", async (sort, order) => {
    const result = await read({ sort })
    expect(result.posts.map((post) => post.id)).toEqual(order.map((index) => ids[index]))
    expect(calls).toBe(1)
  })
  it("combines weighted search with tag and date filtering", async () => {
    const result = await read({
      q: "Uniqueexcerpt",
      sort: "relevance",
      date: "custom",
      from: "2026-01-03",
      to: "2026-01-03",
    })
    expect(result.total).toBe(1)
    expect(result.posts[0].id).toBe(ids[2])
    expect(calls).toBe(1)
    expect((await read({ q: "notfoundterm", sort: "relevance" })).total).toBe(0)
  })
  it.each([
    ["short", [0]],
    ["medium", [2, 1]],
    ["long", [3]],
  ] as const)("enforces %s duration boundaries", async (duration, order) => {
    const result = await read({ duration })
    expect(result.posts.map((post) => post.id)).toEqual(order.map((index) => ids[index]))
  })
  it("uses inclusive custom end dates and combines duration/tag boundaries", async () => {
    const result = await read({
      date: "custom",
      from: "2026-01-01",
      to: "2026-01-03",
      duration: "medium",
      tags: [tags[0].slug],
    })
    expect(result.posts.map((post) => post.id)).toEqual([ids[2]])
  })
  it.each(["7d", "30d", "year"] as const)(
    "uses relative/calendar %s publication bounds",
    async (date) => {
      vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-01-10T00:00:00Z"))
      try {
        const result = await read({ date })
        expect(result.total).toBe(date === "7d" ? 2 : 4)
      } finally {
        vi.restoreAllMocks()
      }
    }
  )
  it("includes every private publication state in the authenticated archive, with no public visibility predicate", async () => {
    const result = await getAdminArchivePosts({
      ...defaultAdminArchiveOptions,
      tags: tags.map((tag) => tag.slug),
    })
    expect(result.total).toBe(8)
    expect(result.posts.map((post) => post.id)).toEqual(ids)
    expect(calls).toBe(1)
    const counts = await getAdminTagsInUse()
    expect(
      counts
        .filter((tag) => tags.some((fixture) => fixture.id === tag.id))
        .map((tag) => tag.postCount)
        .sort()
    ).toEqual([4, 5])
  })
  it.each([
    ["draft", [5]],
    ["archived", [6]],
    ["published", [0, 1, 2, 3, 4, 7]],
  ] as const)(
    "filters private %s status without hiding incomplete author rows",
    async (status, expected) => {
      const result = await getAdminArchivePosts({
        ...defaultAdminArchiveOptions,
        tags: tags.map((tag) => tag.slug),
        status,
      })
      expect(result.posts.map((post) => post.id)).toEqual(expected.map((index) => ids[index]))
      expect(calls).toBe(1)
    }
  )
  it("combines author search, tag, status, publication date and duration criteria", async () => {
    const result = await getAdminArchivePosts({
      ...defaultAdminArchiveOptions,
      tags: [tags[1].slug],
      status: "draft",
      q: "sharedword",
      sort: "relevance",
      date: "custom",
      from: "2026-01-06",
      to: "2026-01-06",
      duration: "short",
    })
    expect(result.posts.map((post) => post.id)).toEqual([ids[5]])
    expect(calls).toBe(1)
    expect(
      (
        await getArchivePosts({ ...defaultArchiveOptions, q: "sharedword", tags: [tags[1].slug] })
      ).posts.map((post) => post.id)
    ).not.toContain(ids[5])
  })
  it("puts null publication dates last when sorting author rows by newest", async () => {
    const result = await getAdminArchivePosts({
      ...defaultAdminArchiveOptions,
      tags: tags.map((tag) => tag.slug),
      sort: "newest",
    })
    expect(result.posts.at(-1)?.id).toBe(ids[7])
    expect(result.posts[0].id).toBe(ids[6])
  })
  it("enforces author authentication before private archive and tag SQL", async () => {
    auth.requireAuthor.mockRejectedValueOnce(new Error("Not authorised"))
    await expect(getAdminArchivePosts()).rejects.toThrow("Not authorised")
    auth.requireAuthor.mockRejectedValueOnce(new Error("Not authorised"))
    await expect(getAdminTagsInUse()).rejects.toThrow("Not authorised")
    expect(calls).toBe(0)
  })
  it("breaks equal timestamps and titles by ID, retaining stable pages", async () => {
    await db
      .update(schema.posts)
      .set({ title: "Same title", publishedAt: new Date("2026-01-01") })
      .where(inArray(schema.posts.id, ids.slice(0, 4)))
    const result = await read({ sort: "title-asc" })
    expect(result.posts.map((post) => post.id)).toEqual(ids.slice(0, 4).sort())
    expect(result.total).toBe(4)
  })
})
