import { randomUUID } from "node:crypto"
import { neonConfig } from "@neondatabase/serverless"
import { inArray } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

// Exercise real ranking SQL independently of the separately tested public cache.
vi.mock("@/lib/cache.server", () => ({
  cachedRead: (_key: string, _tags: string[], read: () => unknown) => read(),
}))

import { getRelatedPosts } from "@/features/writing/data/queries.server"
import { getDb, schema } from "@/lib/db/index.server"

const db = getDb()!
const prefix = `related-${randomUUID()}`
const tags = Array.from({ length: 4 }, (_, index) => ({
  id: randomUUID(),
  slug: `${prefix}-${index}`,
  name: `${prefix} ${index}`,
}))
const ids = Array.from({ length: 12 }, () => randomUUID())
const source = ids[0]
// Insert the larger UUID first, so insertion order cannot accidentally pass the tie test.
const [tieLow, tieHigh] = [ids[2], ids[3]].sort()
ids[2] = tieHigh
ids[3] = tieLow
const body = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Related fixture." }] }],
}
const originalFetch = neonConfig.fetchFunction
let calls = 0

beforeAll(async () => {
  await db.insert(schema.tags).values(tags)
  await db.insert(schema.posts).values(
    ids.map((id, index) => ({
      id,
      slug: `${prefix}-${index}`,
      title: `Related fixture ${index}`,
      status:
        index === 6
          ? ("draft" as const)
          : index === 7
            ? ("archived" as const)
            : ("published" as const),
      // The strongest match is older than every other candidate.
      publishedAt:
        index === 9
          ? null
          : new Date(
              `2026-01-${index === 1 ? "01" : index === 5 ? "02" : index === 2 || index === 3 ? "10" : "30"}T00:00:00Z`
            ),
      contentJson: index === 8 ? null : body,
    }))
  )
  await db.insert(schema.postTags).values(
    ids.flatMap((postId, index) => {
      const shared =
        index === 11
          ? []
          : index === 10
            ? [tags[3]]
            : index === 2 || index === 3
              ? tags.slice(0, 2)
              : index === 4 || index === 5
                ? tags.slice(0, 1)
                : tags.slice(0, 3)
      return shared.map((tag) => ({ postId, tagId: tag.id }))
    })
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

describe("related posts against PostgreSQL", () => {
  it("ranks shared tags before recency and uses the UUID to resolve equal scores and dates", async () => {
    const posts = await getRelatedPosts(source, 10)
    expect(posts.map((post) => post.id)).toEqual([ids[1], tieLow, tieHigh, ids[4], ids[5]])
    expect(calls).toBe(1)
    expect(posts[0].tags).toHaveLength(3)
    expect(posts[0]).not.toHaveProperty("content")
  })

  it("limits recommendations to three by default and honors a smaller requested limit", async () => {
    expect((await getRelatedPosts(source)).map((post) => post.id)).toEqual([
      ids[1],
      tieLow,
      tieHigh,
    ])
    expect((await getRelatedPosts(source, 1)).map((post) => post.id)).toEqual([ids[1]])
    expect(calls).toBe(2)
  })

  it("excludes the source, drafts, archived posts, incomplete posts, and unrelated posts", async () => {
    const posts = await getRelatedPosts(source, 100)
    expect(posts).toHaveLength(5)
    for (const id of [source, ...ids.slice(6)])
      expect(posts.map((post) => post.id)).not.toContain(id)
  })

  it("returns no recommendations for an untagged or nonexistent source", async () => {
    expect(await getRelatedPosts(ids[11])).toEqual([])
    expect(await getRelatedPosts(randomUUID())).toEqual([])
  })
})
