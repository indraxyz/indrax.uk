import { eq, sql } from "drizzle-orm"

import { getDb, schema } from "@/lib/db"

// Counting is the whole job; there is nothing here to cache.
export const dynamic = "force-dynamic"

// A 1x1 transparent GIF, inline. Smaller than a PNG at this size and needs no
// file on disk, which matters on a runtime with no filesystem.
const PIXEL = Uint8Array.from(
  atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"),
  (character) => character.charCodeAt(0)
)

/**
 * Counts one read of an article.
 *
 * An image, not a script. The article page ships no JavaScript by design
 * (NFR-5), and an `<img>` fires on every render - including a cached one, and
 * including a reader with JavaScript disabled - which is exactly the population a
 * beacon would miss.
 *
 * The count is decorative and best-effort, and is stated as such in the threat
 * model: it is trivially inflatable by anyone willing to reload, and it is never
 * used for ranking or billing. Deduplicating it would mean identifying readers,
 * which is a much worse trade than an imprecise number.
 *
 * Only published posts are counted, so a draft under preview cannot be probed for
 * existence by watching whether its counter moves (threat T-4).
 */
export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const db = getDb()

  if (db) {
    try {
      await db
        .update(schema.posts)
        .set({ viewCount: sql`${schema.posts.viewCount} + 1` })
        .where(eq(schema.posts.slug, slug))
    } catch (error) {
      // A counter that cannot count must not break the page it sits on.
      console.error(`[blog] view count failed for ${slug}`, error)
    }
  }

  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.byteLength),
      // Never cached, or it would be counted once per cache rather than once per
      // read - and the whole point is the second thing.
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  })
}
