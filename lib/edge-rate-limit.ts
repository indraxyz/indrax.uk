/**
 * Per-client request limits at the Worker, before any route wakes the database.
 *
 * Better Auth's own limiter covers `/api/auth/*`, but it counts in Postgres - so
 * a flood still costs a Neon round trip per request (threat T-11). These run on
 * Cloudflare's rate-limiting bindings, which answer from the edge without
 * touching the database at all, and they cover every API path a stranger can
 * reach: the admin and upload endpoints (which check the session in Postgres),
 * the public writing API and the view counter (which write to it).
 *
 * Counters are per Cloudflare location and eventually consistent, so these are a
 * brake on floods, not an exact quota. The database limiter stays as the precise
 * one behind them.
 */
type LimiterName = "RATE_LIMIT_STRICT" | "RATE_LIMIT_API"

interface RateLimitBucket {
  binding: LimiterName
  bucket: string
}

/**
 * Which counter a path draws from, or null for paths that are not limited.
 *
 * Strict (30 a minute): sign-in and the view counter, where one honest client
 * needs only a few requests. API (120 a minute): the admin editor and the
 * public archive, whose search and filters issue a request per change.
 */
export function rateLimitBucket(path: string): RateLimitBucket | null {
  if (path.startsWith("/api/auth/")) return { binding: "RATE_LIMIT_STRICT", bucket: "auth" }
  if (path.startsWith("/api/views/")) return { binding: "RATE_LIMIT_STRICT", bucket: "views" }
  if (path.startsWith("/api/admin/") || path === "/api/upload")
    return { binding: "RATE_LIMIT_API", bucket: "admin" }
  if (path.startsWith("/api/writing/")) return { binding: "RATE_LIMIT_API", bucket: "writing" }
  return null
}

const LOOPBACK = new Set(["127.0.0.1", "::1"])

type LimiterEnv = Partial<Record<LimiterName, RateLimit>>

/**
 * A 429 when the caller is over its limit, otherwise null.
 *
 * Keyed on `cf-connecting-ip`, which Cloudflare sets and the client cannot. With
 * no address, a loopback address or no binding, the request passes: the limit is
 * a production brake, and failing open here never weakens the authorization
 * checks behind it. Cloudflare's edge never reports loopback; local Workerd
 * does, for every request, so the parallel browser suite would otherwise share
 * one bucket and throttle itself.
 */
export async function enforceRateLimit(
  request: Request,
  path: string,
  env: LimiterEnv
): Promise<Response | null> {
  const rule = rateLimitBucket(path)
  if (!rule) return null
  const limiter = env[rule.binding]
  const ip = request.headers.get("cf-connecting-ip")
  if (!limiter || !ip || LOOPBACK.has(ip)) return null
  const { success } = await limiter.limit({ key: `${rule.bucket}:${ip}` })
  if (success) return null
  return Response.json(
    { ok: false, message: "Too many requests. Try again in a minute." },
    { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } }
  )
}
