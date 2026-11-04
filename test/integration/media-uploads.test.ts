import { randomUUID } from "node:crypto"
import { Client } from "pg"
import { eq, inArray } from "drizzle-orm"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ remove: vi.fn() }))
vi.mock("@/lib/cover-storage.server", async (original) => ({
  ...(await original<typeof import("@/lib/cover-storage.server")>()),
  getCoverStorageConfig: () => ({
    publicUrl: "https://pending-media-integration.invalid",
    bucket: { delete: mocks.remove },
  }),
}))

import { getDb, schema } from "@/lib/db/index.server"
import {
  attachmentQuery,
  claimTrackedUpload,
  drainPendingUploads,
  registerPendingUpload,
} from "@/features/writing/data/media-uploads.server"

const db = getDb()!
const keys: string[] = []
const posts: string[] = []
const origin = "https://pending-media-integration.invalid"
const textContent = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Pending media fixture" }] }],
}
const imageContent = (key: string) => ({
  ...textContent,
  content: [
    ...textContent.content,
    { type: "image", attrs: { src: `${origin}/${key}`, alt: "Pending image" } },
  ],
})

async function upload({ ageHours = 25, host = origin, prefix = "content" } = {}) {
  const key = `${prefix}/${randomUUID()}.png`
  keys.push(key)
  expect(await registerPendingUpload(key, `${host}/${key}`)).toBe(true)
  await db
    .update(schema.mediaUploads)
    .set({ createdAt: new Date(Date.now() - ageHours * 60 * 60 * 1000) })
    .where(eq(schema.mediaUploads.key, key))
  return key
}

async function post(key?: string) {
  const id = randomUUID()
  posts.push(id)
  await db.insert(schema.posts).values({
    id,
    slug: `pending-media-${id}`,
    title: "Pending media fixture",
    contentJson: key ? imageContent(key) : textContent,
  })
  return id
}

async function state(key: string) {
  const [record] = await db
    .select()
    .from(schema.mediaUploads)
    .where(eq(schema.mediaUploads.key, key))
  return record
}

beforeEach(() => mocks.remove.mockReset().mockResolvedValue(undefined))
afterEach(async () => {
  if (posts.length) await db.delete(schema.posts).where(inArray(schema.posts.id, posts.splice(0)))
  if (keys.length)
    await db.delete(schema.mediaUploads).where(inArray(schema.mediaUploads.key, keys.splice(0)))
})

it.each(["content", "covers"])(
  "expires only unreferenced pending %s uploads after the grace period",
  async (prefix) => {
    const expired = await upload({ prefix })
    const recent = await upload({ ageHours: 1, prefix })
    await drainPendingUploads(db)
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(expired)
    expect((await state(expired)).state).toBe("deleted")
    expect((await state(recent)).state).toBe("pending")
  },
  15_000
)

it("rechecks saved body references and repairs a pending asset to attached", async () => {
  const key = await upload()
  await post(key)
  await drainPendingUploads(db)
  expect(mocks.remove).not.toHaveBeenCalled()
  expect((await state(key)).state).toBe("attached")
}, 15_000)

it("preserves saved cover references including older local/query URL variants", async () => {
  const key = await upload()
  const id = await post()
  await db
    .update(schema.posts)
    .set({ coverUrl: `${origin}/${key}?v=1` })
    .where(eq(schema.posts.id, id))
  expect(await claimTrackedUpload(db, key)).toBe("referenced")
  expect((await state(key)).state).toBe("attached")
  expect(mocks.remove).not.toHaveBeenCalled()
}, 15_000)

it("retains failed deletions for an idempotent retry", async () => {
  const key = await upload()
  mocks.remove.mockRejectedValueOnce(new Error("Storage temporarily unavailable"))
  await drainPendingUploads(db)
  expect((await state(key)).state).toBe("deleting")
  await drainPendingUploads(db)
  expect((await state(key)).state).toBe("deleted")
  expect(mocks.remove).toHaveBeenCalledTimes(2)
}, 15_000)

it("keeps other environment storage untouched", async () => {
  const key = await upload({ host: "https://another-environment.invalid" })
  await drainPendingUploads(db)
  expect(mocks.remove).not.toHaveBeenCalled()
  expect((await state(key)).state).toBe("pending")
}, 15_000)

it("attaches in the same transaction as a successful post write", async () => {
  const key = await upload()
  const id = await post()
  await db.batch([
    db
      .update(schema.posts)
      .set({ contentJson: imageContent(key) })
      .where(eq(schema.posts.id, id)),
    attachmentQuery(db, [key], id),
  ])
  expect((await state(key)).state).toBe("attached")
  expect((await state(key)).attachedAt).toBeInstanceOf(Date)
  await drainPendingUploads(db)
  expect(mocks.remove).not.toHaveBeenCalled()
}, 15_000)

it("does not attach pending uploads when the saved post no longer exists", async () => {
  const key = await upload({ ageHours: 1 })
  await db.batch([attachmentQuery(db, [key], randomUUID())])
  expect((await state(key)).state).toBe("pending")
}, 15_000)

it("rolls back attachment together with a rejected post write", async () => {
  const key = await upload()
  const id = await post()
  const duplicate = await post()
  const [other] = await db
    .select({ slug: schema.posts.slug })
    .from(schema.posts)
    .where(eq(schema.posts.id, duplicate))
  await expect(
    db.batch([
      attachmentQuery(db, [key], id),
      db.update(schema.posts).set({ slug: other.slug }).where(eq(schema.posts.id, id)),
    ])
  ).rejects.toThrow()
  expect((await state(key)).state).toBe("pending")
}, 15_000)

it.each(["deleting", "deleted"] as const)(
  "keeps a %s tombstone from being attached by a stale editor",
  async (retiredState) => {
    const key = await upload()
    const id = await post()
    await db
      .update(schema.mediaUploads)
      .set({ state: retiredState })
      .where(eq(schema.mediaUploads.key, key))
    await expect(
      db.batch([
        db
          .update(schema.posts)
          .set({ contentJson: imageContent(key) })
          .where(eq(schema.posts.id, id)),
        attachmentQuery(db, [key], id),
      ])
    ).rejects.toMatchObject({ code: "23514", constraint: "media_uploads_attach_available" })
    const [saved] = await db
      .select({ content: schema.posts.contentJson })
      .from(schema.posts)
      .where(eq(schema.posts.id, id))
    expect(saved.content).toEqual(textContent)
    expect((await state(key)).state).toBe(retiredState)
  },
  15_000
)

it("distinguishes existing tombstones and untracked legacy images", async () => {
  const key = await upload()
  await db
    .update(schema.mediaUploads)
    .set({ state: "deleted" })
    .where(eq(schema.mediaUploads.key, key))
  expect(await claimTrackedUpload(db, key)).toBe("deleted")
  expect(await claimTrackedUpload(db, `content/${randomUUID()}.png`)).toBe("untracked")
}, 15_000)

function directClient() {
  const value = process.env.TEST_DIRECT_DATABASE_URL
  const connection = new URL(value ?? process.env.TEST_DATABASE_URL!)
  if (!["localhost", "127.0.0.1", "[::1]"].includes(connection.hostname))
    throw new Error("Direct database must be loopback.")
  if (!value) {
    if (connection.port && connection.port !== "4444")
      throw new Error("Set TEST_DIRECT_DATABASE_URL when using a custom local proxy port.")
    connection.port = "55432"
  }
  connection.search = ""
  return new Client({ connectionString: connection.href })
}

async function waitForBlockedQuery(client: Client) {
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
}

it("preserves an image when a concurrent attaching save wins the tracker lock", async () => {
  const key = await upload()
  const id = await post()
  const client = directClient()
  await client.connect()
  let pending: Promise<unknown> | undefined
  try {
    await client.query("BEGIN")
    await client.query(
      "UPDATE media_uploads SET state = 'attached', attached_at = now() WHERE key = $1",
      [key]
    )
    await client.query("UPDATE posts SET content_json = $1 WHERE id = $2", [
      JSON.stringify(imageContent(key)),
      id,
    ])
    pending = claimTrackedUpload(db, key)
    await waitForBlockedQuery(client)
    await client.query("COMMIT")
    expect(await pending).toBe("referenced")
    expect((await state(key)).state).toBe("attached")
  } finally {
    await client.query("ROLLBACK")
    await pending?.catch(() => undefined)
    await client.end()
  }
}, 20_000)

it("rejects and rolls back a concurrent save when retirement wins the tracker lock", async () => {
  const key = await upload()
  const id = await post()
  const client = directClient()
  await client.connect()
  let pending: Promise<unknown> | undefined
  try {
    await client.query("BEGIN")
    await client.query("UPDATE media_uploads SET state = 'deleting' WHERE key = $1", [key])
    pending = db.batch([
      db
        .update(schema.posts)
        .set({ contentJson: imageContent(key) })
        .where(eq(schema.posts.id, id)),
      attachmentQuery(db, [key], id),
    ])
    // Install the rejection handler before releasing the lock.
    const rejected = expect(pending).rejects.toMatchObject({
      code: "23514",
      constraint: "media_uploads_attach_available",
    })
    await waitForBlockedQuery(client)
    await client.query("COMMIT")
    await rejected
    const [saved] = await db
      .select({ content: schema.posts.contentJson })
      .from(schema.posts)
      .where(eq(schema.posts.id, id))
    expect(saved.content).toEqual(textContent)
  } finally {
    await client.query("ROLLBACK")
    await pending?.catch(() => undefined)
    await client.end()
  }
}, 20_000)
