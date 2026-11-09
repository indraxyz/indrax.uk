import { randomUUID } from "node:crypto"
import { eq, inArray } from "drizzle-orm"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ storageAvailable: true, remove: vi.fn() }))
vi.mock("@/lib/auth-guard.server", () => ({ requireAuthor: async () => ({ id: "author" }) }))
vi.mock("@/lib/cache.server", () => ({ invalidateTags: async () => undefined }))
vi.mock("@/features/writing/data/queries.server", () => ({
  CACHE_TAGS: { posts: "posts", post: (slug: string) => `post:${slug}` },
}))
vi.mock("@/lib/cover-storage.server", async (original) => ({
  ...(await original<typeof import("@/lib/cover-storage.server")>()),
  getCoverStorageConfig: () =>
    mocks.storageAvailable
      ? {
          publicUrl: "https://media-posts-integration.invalid",
          bucket: { delete: mocks.remove },
        }
      : null,
}))

import { deletePost, savePost } from "@/features/writing/data/mutations.server"
import { registerPendingUpload } from "@/features/writing/data/media-uploads.server"
import { getDb, schema } from "@/lib/db/index.server"
import type { PostDocument } from "@/features/writing/types"

const db = getDb()!
const origin = "https://media-posts-integration.invalid"
const ids: string[] = []
const keys: string[] = []
const urls: string[] = []
const tagSlugs: string[] = []
const seriesIds: string[] = []
const content: PostDocument = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Saved media fixture." }] }],
}
const imageContent = (url: string): PostDocument => ({
  ...content,
  content: [...content.content!, { type: "image", attrs: { src: url, alt: "Tracked image" } }],
})

async function pendingUpload(prefix = "content") {
  const key = `${prefix}/${randomUUID()}.png`
  keys.push(key)
  const url = `${origin}/${key}`
  urls.push(url)
  expect(await registerPendingUpload(key, url)).toBe(true)
  return { key, url }
}

async function uploadState(key: string) {
  const [row] = await db.select().from(schema.mediaUploads).where(eq(schema.mediaUploads.key, key))
  return row
}

async function postTags(id: string) {
  return db
    .select({ slug: schema.tags.slug })
    .from(schema.postTags)
    .innerJoin(schema.tags, eq(schema.tags.id, schema.postTags.tagId))
    .where(eq(schema.postTags.postId, id))
}

beforeEach(() => {
  mocks.storageAvailable = true
  mocks.remove.mockReset().mockResolvedValue(undefined)
  vi.stubEnv("MEDIA_ORIGIN", origin)
})
afterEach(async () => {
  try {
    if (ids.length) await db.delete(schema.posts).where(inArray(schema.posts.id, ids.splice(0)))
    if (keys.length) {
      const owned = keys.splice(0)
      await db.delete(schema.mediaUploads).where(inArray(schema.mediaUploads.key, owned))
    }
    if (urls.length)
      await db
        .delete(schema.coverCleanup)
        .where(inArray(schema.coverCleanup.url, [...new Set(urls.splice(0))]))
    if (seriesIds.length)
      await db.delete(schema.series).where(inArray(schema.series.id, seriesIds.splice(0)))
    if (tagSlugs.length)
      await db.delete(schema.tags).where(inArray(schema.tags.slug, tagSlugs.splice(0)))
  } finally {
    vi.unstubAllEnvs()
  }
})

it.each(["content", "cover"] as const)(
  "attaches a pending %s image through savePost",
  async (purpose) => {
    const upload = await pendingUpload(purpose === "cover" ? "covers" : "content")
    const result = await savePost({
      title: `Media save ${randomUUID()}`,
      status: "draft",
      tags: [],
      content: purpose === "content" ? imageContent(upload.url) : content,
      ...(purpose === "cover" ? { coverUrl: upload.url, coverAlt: "Tracked cover" } : {}),
    })
    expect(result.ok).toBe(true)
    const id = result.postId!
    ids.push(id)
    expect(await uploadState(upload.key)).toMatchObject({
      state: "attached",
      attachedAt: expect.any(Date),
    })
    const [saved] = await db.select().from(schema.posts).where(eq(schema.posts.id, id))
    expect(saved.contentJson).toEqual(purpose === "content" ? imageContent(upload.url) : content)
    expect(saved.coverUrl).toBe(purpose === "cover" ? upload.url : null)
  },
  15_000
)

it.each(["deleting", "deleted"] as const)(
  "rejects a %s image through savePost and preserves the saved post and tags",
  async (state) => {
    const originalTag = `media-old-${randomUUID()}`
    const replacementTag = `media-new-${randomUUID()}`
    tagSlugs.push(originalTag, replacementTag)
    const originalTitle = `Media original ${randomUUID()}`
    const baseline = await savePost({
      title: originalTitle,
      status: "draft",
      tags: [originalTag],
      content,
    })
    expect(baseline.ok).toBe(true)
    const id = baseline.postId!
    ids.push(id)
    const upload = await pendingUpload()
    await db
      .update(schema.mediaUploads)
      .set({ state })
      .where(eq(schema.mediaUploads.key, upload.key))
    const result = await savePost({
      id,
      title: "Changed by stale editor",
      status: "draft",
      tags: [replacementTag],
      content: imageContent(upload.url),
    })
    expect(result).toEqual({
      ok: false,
      message: "That uploaded image has expired. Insert it again before saving.",
      errors: undefined,
    })
    const [saved] = await db.select().from(schema.posts).where(eq(schema.posts.id, id))
    expect(saved.title).toBe(originalTitle)
    expect(saved.contentJson).toEqual(content)
    expect(await postTags(id)).toEqual([{ slug: originalTag }])
    expect(await db.select().from(schema.tags).where(eq(schema.tags.slug, replacementTag))).toEqual(
      []
    )
    expect((await uploadState(upload.key)).state).toBe(state)
  },
  15_000
)

it.each([true, false])(
  "attaches pending query/fragment image references when storage availability is %s",
  async (storageAvailable) => {
    const upload = await pendingUpload()
    const source = `${upload.url}?width=800#illustration`
    urls.push(source)
    mocks.storageAvailable = storageAvailable
    const result = await savePost({
      title: `Media variant ${randomUUID()}`,
      status: "draft",
      tags: [],
      content: imageContent(source),
    })
    expect(result.ok).toBe(true)
    const id = result.postId!
    ids.push(id)
    expect(await uploadState(upload.key)).toMatchObject({
      state: "attached",
      attachedAt: expect.any(Date),
    })
    const [saved] = await db.select().from(schema.posts).where(eq(schema.posts.id, id))
    // Canonicalization identifies the tracked asset without changing authored URLs.
    expect(saved.contentJson).toEqual(imageContent(source))
  },
  15_000
)

it.each([true, false])(
  "rejects deleted query/fragment image references when storage availability is %s",
  async (storageAvailable) => {
    const id = randomUUID()
    ids.push(id)
    await db.insert(schema.posts).values({
      id,
      slug: `media-variant-${id}`,
      title: "Saved variant fixture",
      contentJson: content,
    })
    const upload = await pendingUpload()
    await db
      .update(schema.mediaUploads)
      .set({ state: "deleted" })
      .where(eq(schema.mediaUploads.key, upload.key))
    mocks.storageAvailable = storageAvailable
    const result = await savePost({
      id,
      title: "Changed by stale URL variant",
      status: "draft",
      tags: [],
      content: imageContent(`${upload.url}?width=800#illustration`),
    })
    expect(result).toMatchObject({
      ok: false,
      message: "That uploaded image has expired. Insert it again before saving.",
    })
    const [saved] = await db.select().from(schema.posts).where(eq(schema.posts.id, id))
    expect(saved.title).toBe("Saved variant fixture")
    expect(saved.contentJson).toEqual(content)
    expect((await uploadState(upload.key)).state).toBe("deleted")
  },
  15_000
)

it("retains a query-variant body image shared with the cover until its final saved reference is removed", async () => {
  const upload = await pendingUpload("covers")
  const coverUrl = `${upload.url}?width=1200#cover`
  const bodyUrl = `${upload.url}?width=800#body`
  urls.push(coverUrl, bodyUrl)
  const title = `Media shared variants ${randomUUID()}`
  const initial = await savePost({
    title,
    status: "draft",
    tags: [],
    content: imageContent(bodyUrl),
    coverUrl,
    coverAlt: "Shared variant cover",
  })
  expect(initial.ok).toBe(true)
  const id = initial.postId!
  ids.push(id)
  expect((await uploadState(upload.key)).state).toBe("attached")
  expect(
    await savePost({
      id,
      title,
      status: "draft",
      tags: [],
      content,
      coverUrl,
      coverAlt: "Shared variant cover",
    })
  ).toMatchObject({ ok: true, postId: id, post: { id } })
  expect(mocks.remove).not.toHaveBeenCalled()
  expect((await uploadState(upload.key)).state).toBe("attached")
  expect(await savePost({ id, title, status: "draft", tags: [], content })).toMatchObject({
    ok: true,
    postId: id,
    post: { id, content, coverUrl: null },
  })
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(upload.key)
  expect((await uploadState(upload.key)).state).toBe("deleted")
  expect(
    await db.select().from(schema.coverCleanup).where(eq(schema.coverCleanup.url, upload.url))
  ).toEqual([])
}, 20_000)

it("deletes a tracked body image with a query/fragment URL when its saved post is deleted", async () => {
  const upload = await pendingUpload()
  const source = `${upload.url}?width=800#illustration`
  urls.push(source)
  const result = await savePost({
    title: `Media deletion variant ${randomUUID()}`,
    status: "draft",
    tags: [],
    content: imageContent(source),
  })
  expect(result.ok).toBe(true)
  const id = result.postId!
  ids.push(id)
  expect((await uploadState(upload.key)).state).toBe("attached")
  expect(await deletePost(id)).toEqual({ ok: true })
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(upload.key)
  expect((await uploadState(upload.key)).state).toBe("deleted")
  expect(
    await db.select().from(schema.coverCleanup).where(eq(schema.coverCleanup.url, upload.url))
  ).toEqual([])
}, 15_000)

it("leaves an upload pending when the post batch fails its series constraint", async () => {
  const seriesId = randomUUID()
  const seriesTitle = `Media transaction ${seriesId}`
  seriesIds.push(seriesId)
  await db
    .insert(schema.series)
    .values({ id: seriesId, slug: `media-transaction-${seriesId}`, title: seriesTitle })
  const first = randomUUID()
  const second = randomUUID()
  ids.push(first, second)
  await db.insert(schema.posts).values([
    {
      id: first,
      slug: `media-first-${first}`,
      title: "First media fixture",
      seriesId,
      seriesOrder: 1,
      contentJson: content,
    },
    {
      id: second,
      slug: `media-second-${second}`,
      title: "Second media fixture",
      seriesId,
      seriesOrder: 2,
      contentJson: content,
    },
  ])
  const upload = await pendingUpload()
  const result = await savePost({
    id: second,
    title: "Failed media update",
    status: "draft",
    tags: [],
    content: imageContent(upload.url),
    seriesTitle,
    seriesOrder: 1,
  })
  expect(result).toMatchObject({ ok: false, errors: { seriesOrder: expect.any(Array) } })
  expect(await uploadState(upload.key)).toMatchObject({ state: "pending", attachedAt: null })
  const [saved] = await db.select().from(schema.posts).where(eq(schema.posts.id, second))
  expect(saved.title).toBe("Second media fixture")
  expect(saved.contentJson).toEqual(content)
  expect(saved.seriesOrder).toBe(2)
}, 15_000)
