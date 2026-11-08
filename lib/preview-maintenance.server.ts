import { timingSafeEqual } from "node:crypto"

import { PRODUCTION_SITE_URL, SITE_URL } from "@/config/site"
import { getCoverStorageConfig } from "./cover-storage.server"
import { getDb } from "./db/index.server"
import { enforceRateLimit } from "./edge-rate-limit"
import { runScheduledMediaCleanup } from "./media-cleanup.server"
import { mediaTypeOf, readBoundedBody, RequestError } from "./request-body.server"
import { getRuntimeEnv, serverEnv } from "./runtime.server"

export const PREVIEW_CLEANUP_PATH = "/api/internal/preview/media-cleanup"
const BODY_LIMIT = 256

function reply(status: number, body: Record<string, unknown>, headers?: HeadersInit): Response {
  const response = Response.json(body, { status, headers })
  response.headers.set("Cache-Control", "no-store")
  response.headers.set("X-Robots-Tag", "noindex, nofollow")
  return response
}

/** Build and runtime configuration must agree; an attacker-controlled Host is insufficient. */
function enabledOrigin(): string | null {
  if (serverEnv("PREVIEW_MAINTENANCE_ENABLED") !== "true") return null
  try {
    const built = new URL(SITE_URL)
    const runtime = serverEnv("SITE_URL")
    if (
      built.protocol !== "https:" ||
      built.origin === PRODUCTION_SITE_URL ||
      built.origin !== SITE_URL ||
      runtime !== SITE_URL
    )
      return null
    return built.origin
  } catch {
    return null
  }
}

/** Hash to equal-size buffers before the constant-time comparison, including wrong-length tokens. */
async function validToken(request: Request, expected: string): Promise<boolean> {
  const header = request.headers.get("authorization") ?? ""
  const candidate = /^Bearer ([^\s]+)$/i.exec(header)?.[1] ?? ""
  const provided = candidate.length <= 512 ? candidate : ""
  const encoder = new TextEncoder()
  const hashes = await Promise.all(
    [provided, expected].map((value) => crypto.subtle.digest("SHA-256", encoder.encode(value)))
  )
  return timingSafeEqual(new Uint8Array(hashes[0]), new Uint8Array(hashes[1]))
}

/** Machine-only staging equivalent of scheduled(); never accepts an author cookie. */
export async function handlePreviewMediaCleanup(request: Request): Promise<Response> {
  const origin = enabledOrigin()
  const token = serverEnv("PREVIEW_MAINTENANCE_TOKEN") ?? ""
  if (!origin || new URL(request.url).origin !== origin || token.length < 32 || token.length > 512)
    return reply(404, { error: "Not found." })
  const limited = await enforceRateLimit(request, PREVIEW_CLEANUP_PATH, {
    RATE_LIMIT_STRICT: getRuntimeEnv().RATE_LIMIT_STRICT as RateLimit | undefined,
  })
  if (limited) {
    limited.headers.set("X-Robots-Tag", "noindex, nofollow")
    return limited
  }
  if (request.method !== "POST") return reply(405, { error: "Use POST." }, { Allow: "POST" })
  if (!(await validToken(request, token))) return reply(401, { error: "Unauthorized." })
  const requestOrigin = request.headers.get("origin")
  if (requestOrigin !== null && requestOrigin !== origin)
    return reply(403, { error: "This request origin is not allowed." })

  try {
    if (mediaTypeOf(request) !== "application/json")
      throw new RequestError(415, "Send an application/json body.")
    const bytes = await readBoundedBody(request, BODY_LIMIT)
    let body: unknown
    try {
      body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
    } catch {
      throw new RequestError(400, "Send an empty JSON object.")
    }
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length)
      throw new RequestError(400, "Send an empty JSON object.")

    // The shared scheduled function tolerates absent setup; an operator request
    // must not claim success when no database/bucket can be cleaned.
    if (!serverEnv("DATABASE_URL")?.trim() || !getDb() || !getCoverStorageConfig())
      return reply(503, { error: "Preview maintenance is not configured." })

    await runScheduledMediaCleanup()
    return reply(200, { ok: true })
  } catch (error) {
    if (error instanceof RequestError) return reply(error.status, { error: error.message })
    // Do not serialize exceptions: upstream failures can contain private URLs.
    console.error("Preview media cleanup invocation failed; tracked work is retained.")
    return reply(500, { error: "Preview media cleanup failed." })
  }
}
