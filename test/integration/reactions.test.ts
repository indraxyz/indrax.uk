import { randomUUID } from "node:crypto"
import { neonConfig } from "@neondatabase/serverless"
import { eq, inArray, sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest"

import { getReactions, setReaction } from "@/features/writing/data/reactions.server"
import { REACTIONS } from "@/features/writing/reactions"
import { getDb, schema } from "@/lib/db/index.server"

const db = getDb()!
const prefix = `reactions-${randomUUID()}`
const visitorId = randomUUID()
const otherVisitorId = randomUUID()
const ids = Array.from({ length: 7 }, () => randomUUID())
const slug = `${prefix}-0`
const contentJson = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Reaction fixture" }] }],
}

beforeAll(async () => {
  await db.insert(schema.posts).values(
    ids.map((id, index) => ({
      id,
      slug: `${prefix}-${index}`,
      title: "Reaction fixture",
      status:
        index === 1
          ? ("draft" as const)
          : index === 2
            ? ("archived" as const)
            : ("published" as const),
      publishedAt:
        index === 3
          ? null
          : index === 4
            ? new Date("2099-01-01T00:00:00Z")
            : new Date("2026-01-01T00:00:00Z"),
      contentJson: index === 5 ? null : contentJson,
    }))
  )
})
beforeEach(async () => {
  await db.delete(schema.postReactions).where(inArray(schema.postReactions.postId, ids))
})
afterAll(async () => {
  await db.delete(schema.posts).where(inArray(schema.posts.id, ids))
})

it("counts multiple emoji independently and returns only this browser's selections", async () => {
  await setReaction(slug, { visitorId, reaction: "love", active: true })
  await setReaction(slug, { visitorId, reaction: "rocket", active: true })
  await setReaction(slug, { visitorId: otherVisitorId, reaction: "love", active: true })
  expect(await getReactions(slug, visitorId)).toEqual({
    counts: { love: 2, noted: 0, thumbsup: 0, fire: 0, rocket: 1 },
    selected: ["love", "rocket"],
  })
  expect((await getReactions(slug)).selected).toEqual([])
  expect((await getReactions(slug, otherVisitorId)).selected).toEqual(["love"])
})

it("returns its own addition and removal immediately through one actual Neon HTTP request each", async () => {
  const previousFetch = neonConfig.fetchFunction
  let requests = 0
  const countFetch: typeof fetch = (input, init) => {
    requests++
    return fetch(input, init)
  }
  neonConfig.fetchFunction = countFetch
  try {
    const added = await setReaction(slug, { visitorId, reaction: "rocket", active: true })
    expect(added).toEqual({
      counts: { love: 0, noted: 0, thumbsup: 0, fire: 0, rocket: 1 },
      selected: ["rocket"],
    })
    expect(requests).toBe(1)
    const removed = await setReaction(slug, { visitorId, reaction: "rocket", active: false })
    expect(removed).toEqual({
      counts: { love: 0, noted: 0, thumbsup: 0, fire: 0, rocket: 0 },
      selected: [],
    })
    expect(requests).toBe(2)
    await getReactions(slug, visitorId)
    expect(requests).toBe(3)
  } finally {
    neonConfig.fetchFunction = previousFetch
  }
})

it("rolls back the ordered HTTP transaction if a following statement fails", async () => {
  await expect(
    db.batch([
      db.insert(schema.postReactions).values({ postId: ids[0], visitorId, reaction: "love" }),
      db.execute(sql`select 1 / 0`),
    ])
  ).rejects.toThrow()
  expect(await getReactions(slug, visitorId)).toMatchObject({ counts: { love: 0 }, selected: [] })
})

it("isolates selections while different visitors add all reaction types concurrently", async () => {
  const inputs = REACTIONS.map((reaction) => ({
    visitorId: randomUUID(),
    reaction,
    active: true,
  }))
  const responses = await Promise.all(inputs.map((input) => setReaction(slug, input)))
  for (let index = 0; index < inputs.length; index++) {
    expect(responses[index].selected).toEqual([inputs[index].reaction])
    for (const count of Object.values(responses[index].counts)) {
      expect(count).toBeGreaterThanOrEqual(0)
      expect(count).toBeLessThanOrEqual(1)
    }
  }
  expect((await getReactions(slug)).counts).toEqual({
    love: 1,
    noted: 1,
    thumbsup: 1,
    fire: 1,
    rocket: 1,
  })
  await Promise.all(inputs.map((input) => setReaction(slug, { ...input, active: false })))
  expect(await getReactions(slug)).toEqual({
    counts: { love: 0, noted: 0, thumbsup: 0, fire: 0, rocket: 0 },
    selected: [],
  })
})

it("makes concurrent repeated additions and removals idempotent", async () => {
  const input = { visitorId, reaction: "noted" as const, active: true }
  const added = await Promise.all(Array.from({ length: 6 }, () => setReaction(slug, input)))
  for (const response of added)
    expect(response).toMatchObject({ counts: { noted: 1 }, selected: ["noted"] })
  expect((await getReactions(slug, visitorId)).counts.noted).toBe(1)
  const removed = await Promise.all(
    Array.from({ length: 6 }, () => setReaction(slug, { ...input, active: false }))
  )
  for (const response of removed)
    expect(response).toMatchObject({ counts: { noted: 0 }, selected: [] })
  expect(await getReactions(slug, visitorId)).toMatchObject({ counts: { noted: 0 }, selected: [] })
})

it.each([1, 2, 3, 4, 5, 99])(
  "refuses hidden or missing posts (%i) for reads and either desired state",
  async (index) => {
    const hiddenSlug = `${prefix}-${index}`
    await expect(getReactions(hiddenSlug, visitorId)).rejects.toMatchObject({ status: 404 })
    for (const active of [true, false])
      await expect(
        setReaction(hiddenSlug, { visitorId, reaction: "fire", active })
      ).rejects.toMatchObject({ status: 404 })
    const rows = await db
      .select()
      .from(schema.postReactions)
      .where(eq(schema.postReactions.visitorId, visitorId))
    expect(rows).toHaveLength(0)
  }
)

it("enforces reaction constraints, uniqueness and post deletion cascade in PostgreSQL", async () => {
  const row = { postId: ids[6], visitorId, reaction: "fire" as const }
  await db.insert(schema.postReactions).values(row)
  await expect(db.insert(schema.postReactions).values(row)).rejects.toThrow()
  await expect(
    db.execute(
      sql`insert into ${schema.postReactions} (post_id, visitor_id, reaction) values (${ids[6]}, ${otherVisitorId}, 'unknown')`
    )
  ).rejects.toThrow()
  await db.delete(schema.posts).where(eq(schema.posts.id, ids[6]))
  expect(
    await db.select().from(schema.postReactions).where(eq(schema.postReactions.postId, ids[6]))
  ).toHaveLength(0)
})
