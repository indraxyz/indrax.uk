import { and, eq, isNotNull, sql } from "drizzle-orm"

import { getDb, schema } from "@/lib/db"
import { logServerError } from "@/lib/observability"

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
 * Only published posts are counted. The response is a byte-identical pixel either
 * way, so this is not an oracle - but a draft's counter has no business quietly
 * accumulating before anyone could have read it.
 *
 * Unauthenticated and unthrottled by nature, which makes it the one write endpoint
 * on the site anybody can reach. The slug is bounded before it reaches the
 * database and the response is trivial, so the exposure is a Worker invocation and
 * one indexed update per request - real, and the reason a platform-level rate
 * limit belongs in front of it (threat T-11).
 */
// Long enough for any slug the validator will accept, short enough that a
// megabyte of path never reaches the database.
const MAX_SLUG_LENGTH = 120

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const db = getDb()

  if (db && slug.length <= MAX_SLUG_LENGTH) {
    try {
      await db
        .update(schema.posts)
        .set({ viewCount: sql`${schema.posts.viewCount} + 1` })
        .where(
          and(
            eq(schema.posts.slug, slug),
            eq(schema.posts.status, "published"),
            isNotNull(schema.posts.publishedAt)
          )
        )
    } catch (error) {
      // A counter that cannot count must not break the page it sits on.
      logServerError(error, { scope: "blog.viewCount", slug })
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
