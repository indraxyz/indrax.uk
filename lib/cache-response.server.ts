import { getExecutionContext } from "./runtime.server"
import { logServerError } from "./observability"

interface ResponseCache {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<unknown>
}

/** Dedicated namespace prevents accidental caching of private/API responses. */
export const OG_CACHE_PATH = "/__indrax-cache/og"
const CACHE_CONTROL = "public, max-age=0, s-maxage=3600"

function cacheable(response: Response): boolean {
  return (
    response.status === 200 &&
    response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() === "image/png" &&
    !response.headers.has("set-cookie") &&
    !/\b(?:private|no-store)\b/i.test(response.headers.get("cache-control") ?? "")
  )
}

/** Cache only public card PNGs; never cache errors or private response bodies. */
export async function cachedResponse(
  keyRequest: Request,
  loader: () => Promise<Response>
): Promise<Response> {
  if (keyRequest.method !== "GET" || new URL(keyRequest.url).pathname !== OG_CACHE_PATH)
    return loader()
  // The internal key includes only card/revision parameters, never visitor headers.
  const key = new Request(keyRequest.url, { method: "GET" })
  let cache: ResponseCache | undefined
  try {
    cache = (globalThis as unknown as { caches?: { default?: ResponseCache } }).caches?.default
    const hit = await cache?.match(key)
    if (hit && cacheable(hit)) return hit.clone()
  } catch (error) {
    logServerError(error, { scope: "cache.image.read" })
    cache = undefined
  }
  const response = await loader()
  if (!cacheable(response)) return response
  const result = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
  result.headers.set("Cache-Control", CACHE_CONTROL)
  if (cache) {
    const entry = result.clone()
    const write = Promise.resolve()
      .then(() => cache!.put(key, entry))
      .catch((error: unknown) => {
        logServerError(error, { scope: "cache.image.write" })
      })
    const execution = getExecutionContext()
    if (execution) execution.waitUntil(write)
    else await write
  }
  return result
}
