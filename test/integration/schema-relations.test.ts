import { randomUUID } from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import { afterAll, expect, it } from "vitest"
import { getDb, schema } from "@/lib/db/index.server"

const db = getDb()!
const postIds: string[] = []
const tagIds: string[] = []
const seriesIds: string[] = []
const cleanupUrls: string[] = []

async function fixture() {
  const postId = randomUUID()
  const tagId = randomUUID()
  const seriesId = randomUUID()
  postIds.push(postId)
  tagIds.push(tagId)
  seriesIds.push(seriesId)
  await db.insert(schema.series).values({ id: seriesId, slug: seriesId, title: "Relation fixture" })
  await db.insert(schema.tags).values({ id: tagId, slug: tagId, name: "Relation fixture" })
  await db
    .insert(schema.posts)
    .values({ id: postId, slug: postId, title: "Relation fixture", seriesId, seriesOrder: 1 })
  await db.insert(schema.postTags).values({ postId, tagId })
  return { postId, tagId, seriesId }
}

afterAll(async () => {
  if (postIds.length) await db.delete(schema.posts).where(inArray(schema.posts.id, postIds))
  if (tagIds.length) await db.delete(schema.tags).where(inArray(schema.tags.id, tagIds))
  if (seriesIds.length) await db.delete(schema.series).where(inArray(schema.series.id, seriesIds))
  if (cleanupUrls.length)
    await db.delete(schema.coverCleanup).where(inArray(schema.coverCleanup.url, cleanupUrls))
})

it("enforces actual database foreign keys for post/tag joins and series membership", async () => {
  const { postId, tagId } = await fixture()
  await expect(db.insert(schema.postTags).values({ postId: randomUUID(), tagId })).rejects.toThrow()
  await expect(db.insert(schema.postTags).values({ postId, tagId: randomUUID() })).rejects.toThrow()
  await expect(
    db.update(schema.posts).set({ seriesId: randomUUID() }).where(eq(schema.posts.id, postId))
  ).rejects.toThrow()
})

it("rejects duplicate post/tag joins, slugs and positions within a series", async () => {
  const { postId, tagId, seriesId } = await fixture()
  await expect(db.insert(schema.postTags).values({ postId, tagId })).rejects.toThrow()
  const otherId = randomUUID()
  postIds.push(otherId)
  await expect(
    db.insert(schema.posts).values({ id: otherId, slug: postId, title: "Duplicate slug" })
  ).rejects.toThrow()
  await expect(
    db
      .insert(schema.posts)
      .values({ id: otherId, slug: otherId, title: "Duplicate position", seriesId, seriesOrder: 1 })
  ).rejects.toThrow()
})

it("cascades joins on post deletion while preserving tags and queued R2 cleanup", async () => {
  const { postId, tagId } = await fixture()
  const url = `https://example.test/covers/${postId}.png`
  cleanupUrls.push(url)
  await db.batch([
    db.insert(schema.coverCleanup).values({ url }),
    db.delete(schema.posts).where(eq(schema.posts.id, postId)),
  ])
  expect(
    await db.select().from(schema.postTags).where(eq(schema.postTags.postId, postId))
  ).toHaveLength(0)
  expect(await db.select().from(schema.tags).where(eq(schema.tags.id, tagId))).toHaveLength(1)
  expect(
    await db.select().from(schema.coverCleanup).where(eq(schema.coverCleanup.url, url))
  ).toHaveLength(1)
})

it("cascades joins on tag deletion while preserving the post", async () => {
  const { postId, tagId } = await fixture()
  await db.delete(schema.tags).where(eq(schema.tags.id, tagId))
  expect(
    await db.select().from(schema.postTags).where(eq(schema.postTags.tagId, tagId))
  ).toHaveLength(0)
  expect(await db.select().from(schema.posts).where(eq(schema.posts.id, postId))).toHaveLength(1)
})

it("clears deleted series membership while preserving its posts", async () => {
  const { postId, seriesId } = await fixture()
  await db.delete(schema.series).where(eq(schema.series.id, seriesId))
  const [post] = await db
    .select({ seriesId: schema.posts.seriesId })
    .from(schema.posts)
    .where(eq(schema.posts.id, postId))
  expect(post).toEqual({ seriesId: null })
})
