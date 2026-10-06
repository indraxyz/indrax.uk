/**
 * Turning a Postgres error code into something an author can act on.
 *
 * Its own module because `mutations.ts` carries `"use server"`, and a
 * `"use server"` file may export nothing but async functions - so a predicate
 * living there could not be exported, and could not be tested. The shape of a
 * driver error is exactly the kind of thing that is wrong until it is checked
 * against a real one, so it needed to be somewhere a test could reach it.
 */

/** The partial unique index enforcing one post per position in a series. */
export const SERIES_ORDER_CONSTRAINT = "idx_posts_series_order_unique"

/**
 * Whether a write failed because two parts claimed the same position.
 *
 * The index is what actually enforces the ordering, and it has to: a check in
 * application code loses the race between two saves, and the author is the only
 * person who could ever hit it. But an unhandled 23505 reaches the author as a
 * 500 with a masked digest, which says nothing about the one field that needs
 * changing - so it is translated rather than left to the error boundary.
 *
 * Read off `cause`, and off the structured `constraint` field rather than the
 * message. Both matter, and the first version got both wrong: Drizzle wraps the
 * driver error in a `DrizzleQueryError` whose own `code` is `undefined` and whose
 * message is the failed SQL - it never names the index at all. A check against
 * the top-level `code` and message therefore matched nothing, and would have let
 * every clash through as a 500. Found by provoking one through the real driver
 * rather than by reading the types.
 */
export function isSeriesOrderClash(error: unknown): boolean {
  const cause = (error as { cause?: unknown })?.cause as
    { code?: unknown; constraint?: unknown; message?: unknown } | undefined

  if (String(cause?.code) !== "23505") return false

  // Exact when the driver supplies it. The message is the fallback for one that
  // does not: Postgres always names the constraint there, even when no
  // structured field carries it.
  if (cause?.constraint === SERIES_ORDER_CONSTRAINT) return true

  return typeof cause?.message === "string" && cause.message.includes(SERIES_ORDER_CONSTRAINT)
}
