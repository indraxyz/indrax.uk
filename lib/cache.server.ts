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
    kv: env.NEXT_INC_CACHE_KV as KVNamespace | undefined,
    db: env.NEXT_TAG_CACHE_D1 as D1Database | undefined,
  }
}
const LIFETIME_SECONDS = 3600
async function version(tag: string, db: D1Database, cache?: RequestCache): Promise<number> {
  let promise = cache?.versions.get(tag)
  if (!promise) {
    promise = db
      .prepare("SELECT revalidatedAt FROM revalidations WHERE tag = ?")
      .bind(tag)
      .first<number>("revalidatedAt")
      .then((value) => value ?? 0)
    cache?.versions.set(tag, promise)
  }
  return promise
}
async function read<T>(
  key: string,
  tags: string[],
  loader: () => Promise<T>,
  cache?: RequestCache
): Promise<T> {
  const { kv, db } = bindings()
  if (!kv || !db) return loader()
  let storageKey: string
  try {
    const versions = await Promise.all(tags.map((tag) => version(tag, db, cache)))
    const bytes = new TextEncoder().encode(JSON.stringify([key, tags, versions]))
    const digest = await crypto.subtle.digest("SHA-256", bytes)
    const hash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("")
    storageKey = `react-router:v1:${hash}`
    const cached = await kv.get<CacheValue<T>>(storageKey, "json")
    if (cached && cached.expiresAt > Date.now()) return cached.data
  } catch (error) {
    logServerError(error, { scope: "cache.read" })
    return loader()
  }
  const data = await loader()
  const write = kv
    .put(storageKey, JSON.stringify({ data, expiresAt: Date.now() + LIFETIME_SECONDS * 1000 }), {
      expirationTtl: LIFETIME_SECONDS,
    })
    .catch((error: unknown) => logServerError(error, { scope: "cache.write" }))
  const execution = getExecutionContext()
  if (execution) execution.waitUntil(write)
  else await write
  return data
}
/** Public results only. Private reads and arbitrary search strings never use KV. */
export function cachedRead<T>(key: string, tags: string[], loader: () => Promise<T>): Promise<T> {
  const cache = requestCache()
  const memoKey = JSON.stringify([key, tags])
  const existing = cache?.values.get(memoKey)
  if (existing) return existing as Promise<T>
  const promise = read(key, tags, loader, cache)
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
