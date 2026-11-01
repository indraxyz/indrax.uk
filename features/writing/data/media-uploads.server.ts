import { and, asc, eq, inArray, ne, or, sql } from "drizzle-orm"

import type { PostDocument } from "@/features/writing/types"
import { getCoverStorageConfig, managedCoverKey } from "@/lib/cover-storage.server"
import { getDb, schema, type Database } from "@/lib/db/index.server"
import { serverEnv } from "@/lib/runtime.server"
import { uploadPolicyForKey } from "@/lib/uploads/policy"

export const PENDING_UPLOAD_GRACE_MS = 24 * 60 * 60 * 1000

/** Record the intended write first: an interrupted/failed R2 upload remains sweepable. */
export async function registerPendingUpload(key: string, url: string): Promise<boolean> {
  const db = getDb()
  if (!db) return false
  if (!uploadPolicyForKey(key)) throw new Error("An upload requires a generated media key.")
  await db.insert(schema.mediaUploads).values({ key, url })
  return true
}

/** Read only generated images in the current storage scope, including older local ports. */
export function collectManagedUploadKeys(
  coverUrl: string | null,
  document: PostDocument
): string[] {
  const publicUrl =
    getCoverStorageConfig()?.publicUrl ?? serverEnv("MEDIA_ORIGIN") ?? process.env.MEDIA_ORIGIN
  if (!publicUrl) return []
  const keys = new Set<string>()
  const collect = (value: unknown) => {
    if (typeof value !== "string") return
    try {
      // URL variants still reference the same R2 object. Normalize only for
      // attachment lookup; deletion continues to require a canonical stored URL.
      const source = new URL(value)
      source.search = ""
      source.hash = ""
      const key = managedCoverKey(source.href, publicUrl)
      if (key) keys.add(key)
    } catch {
      // Malformed authored URLs cannot identify a tracked asset.
    }
  }
  collect(coverUrl)
  const walk = (node: PostDocument) => {
    if (node.type === "image") collect(node.attrs?.src)
    for (const child of node.content ?? []) walk(child)
  }
  walk(document)
  return [...keys].sort()
}

/** Execute after writePost in that same batch; retirement guard failures roll everything back. */
export function attachmentQuery(db: Database, keys: readonly string[], postId: string) {
  return db
    .update(schema.mediaUploads)
    .set({ state: "attached", attachedAt: sql`coalesce(${schema.mediaUploads.attachedAt}, now())` })
    .where(
      and(
        inArray(schema.mediaUploads.key, [...keys]),
        sql`exists (select 1 from ${schema.posts} where ${schema.posts.id} = ${postId})`
      )
    )
}

/** Conservatively retain any saved cover/body reference, including URL query variants. */
function hasSavedReference(key: string) {
  return sql`exists (
    select 1 from ${schema.posts}
    where ${schema.posts.coverUrl} like ${`%/${key}%`}
      or ${schema.posts.contentJson}::text like ${`%/${key}%`}
  )`
}

export type UploadClaim = "claimed" | "referenced" | "deleted" | "untracked"

/**
 * Lock first, then check references in a fresh statement snapshot. A single UPDATE
 * could wait on an attaching save while its reference subquery retained an older
 * snapshot. The two statements share a transaction via Neon's existing batch API.
 */
export async function claimTrackedUpload(db: Database, key: string): Promise<UploadClaim> {
  const [locked, claimed] = await db.batch([
    db
      .select({ state: schema.mediaUploads.state })
      .from(schema.mediaUploads)
      .where(eq(schema.mediaUploads.key, key))
      .for("update"),
    db
      .update(schema.mediaUploads)
      .set({ state: "deleting", attemptedAt: new Date() })
      .where(
        and(
          eq(schema.mediaUploads.key, key),
          ne(schema.mediaUploads.state, "deleted"),
          sql`not ${hasSavedReference(key)}`
        )
      )
      .returning({ key: schema.mediaUploads.key }),
    // Repair pending legacy/manual references rather than repeatedly scanning them.
    db
      .update(schema.mediaUploads)
      .set({ state: "attached", attachedAt: sql`now()` })
      .where(
        and(
          eq(schema.mediaUploads.key, key),
          eq(schema.mediaUploads.state, "pending"),
          hasSavedReference(key)
        )
      ),
  ])
  if (!locked[0]) return "untracked"
  if (locked[0].state === "deleted") return "deleted"
  return claimed[0] ? "claimed" : "referenced"
}

export async function markUploadDeleted(db: Database, key: string): Promise<void> {
  await db
    .update(schema.mediaUploads)
    .set({ state: "deleted", attemptedAt: new Date() })
    .where(and(eq(schema.mediaUploads.key, key), eq(schema.mediaUploads.state, "deleting")))
}

/** Bounded scheduled cleanup; failed deletion remains claimed and retries next time. */
export async function drainPendingUploads(db: Database): Promise<void> {
  const storage = getCoverStorageConfig()
  if (!storage) return
  const candidates = await db
    .select({ key: schema.mediaUploads.key, url: schema.mediaUploads.url })
    .from(schema.mediaUploads)
    .where(
      or(
        and(
          eq(schema.mediaUploads.state, "pending"),
          sql`${schema.mediaUploads.createdAt} <= now() - (${PENDING_UPLOAD_GRACE_MS}::double precision * interval '1 millisecond')`
        ),
        eq(schema.mediaUploads.state, "deleting")
      )
    )
    .orderBy(
      asc(schema.mediaUploads.attemptedAt),
      asc(schema.mediaUploads.createdAt),
      asc(schema.mediaUploads.key)
    )
    .limit(20)
  for (const candidate of candidates) {
    // Rotate even refused scopes so a stale local/environment row cannot starve work.
    await db
      .update(schema.mediaUploads)
      .set({ attemptedAt: new Date() })
      .where(eq(schema.mediaUploads.key, candidate.key))
    if (managedCoverKey(candidate.url, storage.publicUrl) !== candidate.key) continue
    try {
      if ((await claimTrackedUpload(db, candidate.key)) !== "claimed") continue
      await storage.bucket.delete(candidate.key)
      await markUploadDeleted(db, candidate.key)
    } catch {
      console.error("Pending media cleanup failed; its durable record will retry.")
    }
  }
}
