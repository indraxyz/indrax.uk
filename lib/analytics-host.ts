/**
 * Where analytics events are sent.
 *
 * Its own module because two very different files need the same answer and must
 * not drift: `lib/analytics.ts` points the tracker at it, and `next.config.ts`
 * names it in `connect-src` so the browser will allow the request. If those two
 * disagree the Content-Security-Policy silently blocks every event, and nothing
 * about that failure looks like a misconfigured constant.
 *
 * Read at build time in both places - `NEXT_PUBLIC_*` is inlined - so this is a
 * constant by the time either runs.
 */
const DEFAULT_HOST = "https://us.i.posthog.com"

/**
 * The origin, and nothing else.
 *
 * A CSP is a `;`-separated string, so a value carrying a semicolon, a space or a
 * path does not merely fail to match - it rewrites the rest of the policy or
 * voids the directive, and the browser reports neither. Reducing to the origin
 * makes that impossible to express and normalises the trailing-slash and
 * path-suffix cases that are otherwise a silent mismatch.
 *
 * Falls back rather than throwing: this runs inside `next.config.ts`, and a
 * typo in an optional analytics variable should not stop the site building.
 */
function originOf(value: string | undefined): string {
  if (!value) return DEFAULT_HOST

  try {
    const { origin, protocol } = new URL(value)

    return protocol === "https:" || protocol === "http:" ? origin : DEFAULT_HOST
  } catch {
    return DEFAULT_HOST
  }
}

export const POSTHOG_HOST = originOf(process.env.NEXT_PUBLIC_POSTHOG_HOST)
