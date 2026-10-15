import { randomUUID } from "node:crypto"
import { Client } from "pg"
import { eq, inArray } from "drizzle-orm"
import { afterAll, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ remove: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@/lib/auth-guard.server", () => ({ requireAuthor: async () => ({ id: "author" }) }))
vi.mock("@/lib/cache.server", () => ({ invalidateTags: async () => undefined }))
vi.mock("@/features/writing/data/queries.server", () => ({
  CACHE_TAGS: { posts: "posts", post: (slug: string) => `post:${slug}` },
}))
vi.mock("@/lib/cover-storage.server", async (original) => ({
  ...(await original<typeof import("@/lib/cover-storage.server")>()),
  getCoverStorageConfig: () => ({
    bucket: { delete: mocks.remove },
    publicUrl: "https://cover-cleanup-integration.invalid",
  }),
}))

import { deletePost, savePost } from "@/features/writing/data/mutations.server"
import { getDb, schema } from "@/lib/db/index.server"

const db = getDb()!
const ids: string[] = []
const urls: string[] = []
const seriesIds: string[] = []
const content = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Cover cleanup fixture." }] }],
}

async function fixture(
  coverUrl = `https://cover-cleanup-integration.invalid/covers/${randomUUID()}.png`
) {
  const id = randomUUID()
  ids.push(id)
  urls.push(coverUrl)
  const [post] = await db
    .insert(schema.posts)
    .values({
      id,
      slug: `cover-cleanup-${id}`,
      title: "Cover cleanup",
      coverUrl,
      contentJson: content,
    })
    .returning()
  return post
}

beforeEach(() => mocks.remove.mockReset().mockResolvedValue(undefined))
afterAll(async () => {
  await db.delete(schema.posts).where(inArray(schema.posts.id, ids))
  await db.delete(schema.coverCleanup).where(inArray(schema.coverCleanup.url, urls))
  if (seriesIds.length) await db.delete(schema.series).where(inArray(schema.series.id, seriesIds))
})

it("clears a saved cover and awaits deletion of its generated R2 key", async () => {
  const post = await fixture()
  expect(
    await savePost({
      id: post.id,
      slug: post.slug,
      title: post.title,
      status: "draft",
      tags: [],
      content,
    })
  ).toEqual({ ok: true, postId: post.id })
  const [saved] = await db.select().from(schema.posts).where(eq(schema.posts.id, post.id))
  expect(saved.coverUrl).toBeNull()
  expect(mocks.remove).toHaveBeenCalledWith(new URL(post.coverUrl!).pathname.slice(1))
  expect(
    await db.select().from(schema.coverCleanup).where(eq(schema.coverCleanup.url, post.coverUrl!))
  ).toEqual([])
})

it("retains a reused object until the last referencing post is deleted", async () => {
  const first = await fixture()
  const second = await fixture(first.coverUrl!)
  expect(await deletePost(first.id)).toEqual({ ok: true })
  expect(mocks.remove).not.toHaveBeenCalled()
  expect(
    await db.select().from(schema.coverCleanup).where(eq(schema.coverCleanup.url, first.coverUrl!))
  ).toHaveLength(1)
  expect(await deletePost(second.id)).toEqual({ ok: true })
  expect(mocks.remove).toHaveBeenCalledWith(new URL(first.coverUrl!).pathname.slice(1))
  expect(
    await db.select().from(schema.coverCleanup).where(eq(schema.coverCleanup.url, first.coverUrl!))
  ).toEqual([])
})

it("retains images referenced in another post's inline content", async () => {
  const first = await fixture()
  const second = await fixture()
  await db
    .update(schema.posts)
    .set({
      coverUrl: null,
      contentJson: { type: "doc", content: [{ type: "image", attrs: { src: first.coverUrl! } }] },
    })
    .where(eq(schema.posts.id, second.id))
  await deletePost(first.id)
  expect(mocks.remove).not.toHaveBeenCalled()
  await deletePost(second.id)
  expect(mocks.remove).toHaveBeenCalledWith(new URL(first.coverUrl!).pathname.slice(1))
})

it("commits post deletion and retains failed cleanup for the next mutation to retry", async () => {
  const post = await fixture()
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
  mocks.remove.mockRejectedValueOnce(new Error("Simulated R2 outage"))
  try {
    expect(await deletePost(post.id)).toEqual({ ok: true })
    expect(await db.select().from(schema.posts).where(eq(schema.posts.id, post.id))).toEqual([])
    expect(
      await db.select().from(schema.coverCleanup).where(eq(schema.coverCleanup.url, post.coverUrl!))
    ).toHaveLength(1)
    const next = await fixture()
    await deletePost(next.id)
    expect(
      await db.select().from(schema.coverCleanup).where(eq(schema.coverCleanup.url, post.coverUrl!))
    ).toEqual([])
    expect(mocks.remove).toHaveBeenCalledWith(new URL(post.coverUrl!).pathname.slice(1))
  } finally {
    error.mockRestore()
  }
}, 15_000)

it("rolls back cover cleanup together with a post update rejected by the series uniqueness constraint", async () => {
  const first = await fixture()
  const second = await fixture()
  const seriesId = randomUUID()
  const seriesTitle = `Cover cleanup series ${seriesId}`
  seriesIds.push(seriesId)
  await db.insert(schema.series).values({
    id: seriesId,
    slug: seriesTitle.toLowerCase().replaceAll(" ", "-"),
    title: seriesTitle,
  })
  await db
    .update(schema.posts)
    .set({ seriesId, seriesOrder: 1 })
    .where(eq(schema.posts.id, first.id))
  await db
    .update(schema.posts)
    .set({ seriesId, seriesOrder: 2 })
    .where(eq(schema.posts.id, second.id))
  expect(
    await savePost({
      id: second.id,
      slug: second.slug,
      title: second.title,
      status: "draft",
      tags: [],
      content,
      seriesTitle,
      seriesOrder: 1,
    })
  ).toMatchObject({ ok: false, errors: { seriesOrder: expect.any(Array) } })
  const [saved] = await db.select().from(schema.posts).where(eq(schema.posts.id, second.id))
  expect(saved.coverUrl).toBe(second.coverUrl)
  expect(saved.seriesOrder).toBe(2)
  expect(
    await db.select().from(schema.coverCleanup).where(eq(schema.coverCleanup.url, second.coverUrl!))
  ).toEqual([])
  expect(mocks.remove).not.toHaveBeenCalled()
}, 15_000)

// Hold an uncommitted competing edit so the HTTP mutation's validation reads
// the previous cover. Release it only once PostgreSQL confirms the mutation is
// waiting on that row, avoiding timing-dependent concurrent test assertions.
async function whilePostLocked(
  postId: string,
  competingWrite: "replace" | "delete",
  mutate: () => Promise<unknown>
) {
  const connection = new URL(process.env.TEST_DATABASE_URL!)
  connection.port = "55432"
  connection.search = ""
  const client = new Client({ connectionString: connection.href })
  await client.connect()
  let pending: Promise<unknown> | undefined
  const replacement = `https://cover-cleanup-integration.invalid/covers/${randomUUID()}.png`
  urls.push(replacement)
  try {
    await client.query("BEGIN")
    if (competingWrite === "replace") {
      await client.query("UPDATE posts SET cover_url = $1 WHERE id = $2", [replacement, postId])
    } else {
      await client.query("DELETE FROM posts WHERE id = $1", [postId])
    }
    pending = mutate()
    await expect
      .poll(
        async () => {
          await client.query("SELECT pg_stat_clear_snapshot()")
          const result = await client.query<{ waiting: boolean }>(
            "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE pg_backend_pid() = ANY(pg_blocking_pids(pid))) AS waiting"
          )
          return result.rows[0].waiting
        },
        { timeout: 5_000 }
      )
      .toBe(true)
    await client.query("COMMIT")
    return { result: await pending, replacement }
  } finally {
    await client.query("ROLLBACK")
    if (pending) await pending.catch(() => undefined)
    await client.end()
  }
}

it.each(["save", "delete"] as const)(
  "queues the actual detached cover after a concurrent replacement before %s",
  async (operation) => {
    const post = await fixture()
    const { result, replacement } = await whilePostLocked(post.id, "replace", () =>
      operation === "delete"
        ? deletePost(post.id)
        : savePost({
            id: post.id,
            slug: post.slug,
            title: post.title,
            status: "draft",
            tags: [],
            content,
          })
    )
    expect(result).toMatchObject({ ok: true })
    expect(mocks.remove).toHaveBeenCalledWith(new URL(replacement).pathname.slice(1))
    expect(
      await db.select().from(schema.coverCleanup).where(eq(schema.coverCleanup.url, replacement))
    ).toEqual([])
  },
  15_000
)

it("returns a missing-post error if deletion wins while an existing post is being saved", async () => {
  const post = await fixture()
  const tag = `race-${randomUUID().slice(0, 8)}`
  try {
    const { result } = await whilePostLocked(post.id, "delete", () =>
      savePost({
        id: post.id,
        slug: post.slug,
        title: post.title,
        status: "draft",
        tags: [tag],
        content,
      })
    )
    expect(result).toMatchObject({ ok: false, message: "That post no longer exists." })
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(
      await db.select().from(schema.postTags).where(eq(schema.postTags.postId, post.id))
    ).toEqual([])
  } finally {
    await db.delete(schema.tags).where(eq(schema.tags.slug, tag))
  }
}, 15_000)
