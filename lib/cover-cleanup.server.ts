import { eq, or, sql } from "drizzle-orm"
import { getCoverStorageConfig, managedCoverKey } from "./cover-storage.server"
import { schema, type Database } from "./db/index.server"

/**
 * Await cleanup after committing the post. Keep failed work for the next author
 * mutation instead of claiming a failed save after its database write committed.
 * The outbox is intentionally bounded; no bucket listing or remote credentials.
 */
export async function drainCoverCleanup(db: Database): Promise<void> {
  try {
    const storage = getCoverStorageConfig()
    if (!storage) return
    const pending = await db
      .select({ url: schema.coverCleanup.url })
      .from(schema.coverCleanup)
      .orderBy(schema.coverCleanup.attemptedAt, schema.coverCleanup.url)
      .limit(20)

    for (const { url } of pending) {
      await db
        .update(schema.coverCleanup)
        .set({ attemptedAt: new Date() })
        .where(eq(schema.coverCleanup.url, url))
      const key = managedCoverKey(url, storage.publicUrl)
      // Unknown origins/keys may belong to another environment. Leave them for
      // investigation rather than deleting an object from the wrong bucket.
      if (!key) continue
      try {
        const [reference] = await db
          .select({ id: schema.posts.id })
          .from(schema.posts)
          .where(
            or(
              sql`${schema.posts.coverUrl} like ${`%/${key}`}`,
              sql`${schema.posts.contentJson}::text like ${`%/${key}%`}`
            )
          )
          .limit(1)
        // Covers can be manually reused as another cover or an inline image.
        // Match the key as well as the URL so local port changes are harmless.
        if (reference) continue
        await storage.bucket.delete(key)
        await db.delete(schema.coverCleanup).where(eq(schema.coverCleanup.url, url))
      } catch {
        console.error("Cover cleanup pending; it will retry on the next post mutation.")
      }
    }
  } catch {
    console.error("Cover cleanup unavailable; pending work has been retained.")
  }
}
