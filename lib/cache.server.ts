import { getExecutionContext, getRequest, getRuntimeEnv } from "./runtime.server"
import { logServerError } from "./observability"

interface CacheValue<T> {
  data: T
  expiresAt: number
}
interface RequestCache {
  values: Map<string, Promise<unknown>>
  versions: Map<string, Promise<number>>
}
const requests = new WeakMap<Request, RequestCache>()
function requestCache(): RequestCache | undefined {
  try {
    const request = getRequest()
    let cache = requests.get(request)
    if (!cache) {
      cache = { values: new Map(), versions: new Map() }
      requests.set(request, cache)
    }
    return cache
  } catch {
    return undefined
  }
}
function bindings() {
  const env = getRuntimeEnv()
  return {
    kv: env.CACHE_KV as KVNamespace | undefined,
    db: env.APP_D1 as D1Database | undefined,
  }
}
const LIFETIME_SECONDS = 3600

export interface CacheReadOptions {
  /** Persistent freshness from read start; KV requires at least 60 seconds. */
  lifetimeSeconds?: number
  /** Optional earlier absolute expiry, computed only on a persistent miss. */
  freshUntil?: (startedAt: number) => Promise<number | undefined>
}

interface RevisionRow {
  tag: string
  revalidatedAt: number
}

function versions(tags: string[], db: D1Database, cache?: RequestCache): Promise<number[]> {
  const memo = cache?.versions ?? new Map<string, Promise<number>>()
  const missing = [...new Set(tags)].filter((tag) => !memo.has(tag))
  if (missing.length) {
    const rows = db
      .prepare(
        missing
          .map(() => "SELECT tag, revalidatedAt FROM revalidations WHERE tag = ?")
          .join(" UNION ALL ")
      )
      .bind(...missing)
      .all<RevisionRow>()
      .then(({ results }) => new Map(results.map((row) => [row.tag, row.revalidatedAt])))
    // Install promises before yielding, so overlapping reads reuse pending tags.
    // Completion never writes back into the map: invalidation can safely clear it.
    for (const tag of missing)
      memo.set(
        tag,
        rows.then((values) => values.get(tag) ?? 0)
      )
  }
  return Promise.all(tags.map((tag) => memo.get(tag)!))
}
async function read<T>(
  key: string,
  tags: string[],
  loader: () => Promise<T>,
  lifetimeSeconds: number,
  freshUntil: CacheReadOptions["freshUntil"],
  cache?: RequestCache
): Promise<T> {
  const startedAt = Date.now()
  let expiresAt = startedAt + lifetimeSeconds * 1000
  const { kv, db } = bindings()
  if (!kv || !db) return loader()
  let storageKey: string
  try {
    const revisions = await versions(tags, db, cache)
    const bytes = new TextEncoder().encode(
      JSON.stringify([key, tags, revisions, lifetimeSeconds, Boolean(freshUntil)])
    )
    const digest = await crypto.subtle.digest("SHA-256", bytes)
    const hash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("")
    storageKey = `react-router:v2:${hash}`
    const cached = await kv.get<CacheValue<T>>(storageKey, "json")
    if (cached && cached.expiresAt > Date.now()) return cached.data
  } catch (error) {
    logServerError(error, { scope: "cache.read" })
    return loader()
  }
  // Start policy lookup with the loader so a cold miss adds no sequential trip.
  // A failed policy read must not hide content or persist an unsafe deadline.
  const deadline = freshUntil
    ? Promise.resolve()
        .then(() => freshUntil(startedAt))
        .then(
          (value) => ({ value, failed: false }),
          (error: unknown) => {
            logServerError(error, { scope: "cache.expiration" })
            return { value: undefined, failed: true }
          }
        )
    : undefined
  const data = await loader()
  if (deadline) {
    const result = await deadline
    if (result.failed) return data
    if (result.value !== undefined) {
      if (!Number.isFinite(result.value)) return data
      expiresAt = Math.min(expiresAt, result.value)
    }
  }
  // A slow pre-publication read must not acquire a fresh lifetime at completion.
  if (expiresAt <= Date.now()) return data
  const write = kv
    .put(storageKey, JSON.stringify({ data, expiresAt }), {
      expirationTtl: lifetimeSeconds,
    })
    .catch((error: unknown) => logServerError(error, { scope: "cache.write" }))
  const execution = getExecutionContext()
  if (execution) execution.waitUntil(write)
  else await write
  return data
}
/** Public results only. Private reads and arbitrary search strings never use KV. */
export function cachedRead<T>(
  key: string,
  tags: string[],
  loader: () => Promise<T>,
  { lifetimeSeconds = LIFETIME_SECONDS, freshUntil }: CacheReadOptions = {}
): Promise<T> {
  if (!Number.isSafeInteger(lifetimeSeconds) || lifetimeSeconds < 60)
    throw new RangeError("Cache lifetime must be an integer of at least 60 seconds.")
  const cache = requestCache()
  const memoKey = JSON.stringify([key, tags, lifetimeSeconds, Boolean(freshUntil)])
  const existing = cache?.values.get(memoKey)
  if (existing) return existing as Promise<T>
  const promise = read(key, tags, loader, lifetimeSeconds, freshUntil, cache)
  cache?.values.set(memoKey, promise)
  return promise
}
/** D1 provides strongly consistent revision keys; KV propagation cannot resurrect an old revision. */
export async function invalidateTags(...tags: string[]): Promise<void> {
  const { db } = bindings()
  if (db) {
    await db.batch(
      [...new Set(tags)].map((tag) =>
        db
          .prepare(
            "INSERT INTO revalidations (tag, revalidatedAt) VALUES (?, ?) ON CONFLICT(tag) DO UPDATE SET revalidatedAt = max(excluded.revalidatedAt, revalidations.revalidatedAt + 1)"
          )
          .bind(tag, Date.now())
      )
    )
  }
  const cache = requestCache()
  cache?.values.clear()
  cache?.versions.clear()
}
