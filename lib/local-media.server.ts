import { getRequest, getRuntimeEnv, serverEnv } from "./runtime.server"
import { IMAGE_FORMATS } from "./uploads/file-signature"
import {
  isLocalMediaPath,
  isLoopbackUrl,
  localMediaOrigin,
  LOCAL_MEDIA_PREFIX,
} from "./uploads/local-media"
import { UPLOAD_POLICIES } from "./uploads/policy"

export function usesLocalMedia(): boolean {
  if (serverEnv("NODE_ENV") !== "development") return false
  const request = getRequest()
  const origin = localMediaOrigin(serverEnv("MEDIA_ORIGIN"))
  return Boolean(
    origin && isLoopbackUrl(request.url) && origin.origin === new URL(request.url).origin
  )
}

/** Local development only: stream covers from the simulated R2 binding. */
export async function serveLocalMedia(request: Request): Promise<Response> {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; sandbox; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  })
  if (!usesLocalMedia()) return new Response(null, { status: 404, headers })
  if (!["GET", "HEAD"].includes(request.method)) {
    headers.set("Allow", "GET, HEAD")
    return new Response(null, { status: 405, headers })
  }
  const path = new URL(request.url).pathname
  if (!isLocalMediaPath(path)) return new Response(null, { status: 404, headers })
  const bucket = getRuntimeEnv().MEDIA_BUCKET as R2Bucket | undefined
  if (!bucket) return new Response(null, { status: 503, headers })
  const key = path.slice(LOCAL_MEDIA_PREFIX.length)
  let object: R2Object | null
  let body: ReadableStream | null = null
  if (request.method === "HEAD") object = await bucket.head(key)
  else {
    const stored = await bucket.get(key)
    object = stored
    body = stored?.body ?? null
  }
  if (!object) return new Response(null, { status: 404, headers })
  const type = UPLOAD_POLICIES.cover.types.find(
    (type) =>
      object.httpMetadata?.contentType === type && key.endsWith(`.${IMAGE_FORMATS[type].extension}`)
  )
  if (!type || object.size > UPLOAD_POLICIES.cover.maxBytes)
    return new Response(null, { status: 404, headers })
  headers.set("Content-Type", type)
  headers.set("Content-Length", String(object.size))
  headers.set("Content-Disposition", "inline")
  headers.set("ETag", object.httpEtag)
  return new Response(body, { headers })
}
