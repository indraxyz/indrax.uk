import { drainPendingUploads } from "@/features/writing/data/media-uploads.server"
import { drainCoverCleanup } from "./cover-cleanup.server"
import { getDb } from "./db/index.server"

/** Scheduled work is awaited by the Worker; neither branch depends on another edit. */
export async function runScheduledMediaCleanup(): Promise<void> {
  const db = getDb()
  if (!db) return
  // Retry the detached-image outbox even if pending-upload cleanup encounters an outage.
  let failed = false
  for (const cleanup of [drainPendingUploads, drainCoverCleanup]) {
    try {
      await cleanup(db)
    } catch {
      failed = true
      console.error("Scheduled media cleanup failed; tracked work will retry next hour.")
    }
  }
  if (failed) throw new Error("Scheduled media cleanup was incomplete; tracked work is retained.")
}
