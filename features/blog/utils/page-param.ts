import { BLOG_CONFIG } from "@/features/blog/config"

/**
 * The page number a request is asking for, bounded.
 *
 * Anything unparseable is page one rather than a 404 - a stale or hand-edited link
 * should land somewhere real. The upper bound is the important half: this value
 * becomes part of a cache key, so an unbounded one lets an anonymous request
 * manufacture as many cache misses as it likes, each costing two database queries
 * (threat T-11). Clamping inside the query would be too late.
 */
export function parsePageParam(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10)

  if (!Number.isFinite(parsed) || parsed < 1) return 1

  return Math.min(parsed, BLOG_CONFIG.maxPage)
}
