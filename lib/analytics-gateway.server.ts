import { ANALYTICS_GATEWAY_PATH, ANALYTICS_GATEWAY_TOKEN } from "./analytics-gateway"
import { assertSameOrigin, mediaTypeOf, readBoundedBody, RequestError } from "./request-body.server"
import { getRuntimeEnv, serverEnv } from "./runtime.server"

const MAX_BODY = 1024 * 1024
const MAX_REPLAY_BODY = 2 * MAX_BODY
// Pinned recorder assets are currently under 256 KiB. Bound responses without
// spending a multi-megabyte reservation for every consented visitor.
const MAX_RESPONSE = 512 * 1024
const encoder = new TextEncoder()
const decoder = new TextDecoder("utf-8", { fatal: true })
const EVENTS = new Set([
  "$pageview",
  "$pageleave",
  "$autocapture",
  "$rageclick",
  "$dead_click",
  "$web_vitals",
  "$feature_flag_called",
  "resume_pdf_downloaded",
  "contact_clicked",
])
const REGIONS: Record<string, string | undefined> = {
  "https://us.i.posthog.com": "https://us-assets.i.posthog.com",
  "https://eu.i.posthog.com": "https://eu-assets.i.posthog.com",
}
const ASSETS =
  /^\/static\/(?:\d+\.\d+\.\d+\/)?(?:lazy-recorder|recorder|recorder-v2|posthog-recorder|rrweb-console-plugin)\.js$/
type Category = "events" | "replay" | "flags" | "config" | "assets"
const LIMITS: Record<Category, { units: number; bytes: number }> = {
  // Each of two environments receives 25% of the published free allowance.
  events: { units: 250_000, bytes: 512 * MAX_BODY },
  replay: { units: 100_000, bytes: 512 * MAX_BODY },
  flags: { units: 250_000, bytes: 256 * MAX_BODY },
  config: { units: 10_000, bytes: 1_280 * MAX_BODY },
  assets: { units: 10_000, bytes: 5_120 * MAX_BODY },
}
const MAX_RECORDINGS = 1_250

// Admit the entire set of new sessions or none. D1 batch makes admission and
// verification one transaction, including requests arriving at different edges.
const REPLAY_ADMISSION_SQL = `
WITH requested AS (SELECT DISTINCT value AS session_id FROM json_each(?2)),
new_sessions AS (
  SELECT session_id FROM requested WHERE NOT EXISTS (
    SELECT 1 FROM analytics_replay_sessions WHERE month = ?1
      AND session_id = requested.session_id
  )
)
INSERT INTO analytics_replay_sessions (month, session_id)
SELECT ?1, session_id FROM new_sessions
WHERE (SELECT COUNT(*) FROM analytics_replay_sessions WHERE month = ?1)
  + (SELECT COUNT(*) FROM new_sessions) <= ?3`
const REPLAY_MISSING_SQL = `
SELECT COUNT(*) AS missing FROM json_each(?2) AS requested
WHERE NOT EXISTS (
  SELECT 1 FROM analytics_replay_sessions WHERE month = ?1
    AND session_id = requested.value
)`

function monthlyLimit(name: string, ceiling: number): number {
  const configured = serverEnv(name)
  const limit = configured === undefined ? ceiling : Number(configured)
  if (!Number.isSafeInteger(limit) || limit < 0 || limit > ceiling)
    throw new RequestError(503, "Invalid analytics limit.")
  return limit
}

// One SQL statement is atomic across Workers, unlike KV or per-location counters.
export const ANALYTICS_QUOTA_RESERVATION_SQL = `
INSERT INTO analytics_quota (month, category, units, bytes)
SELECT ?1, ?2, ?3, ?4 WHERE ?3 <= ?5 AND ?4 <= ?6
ON CONFLICT(month, category) DO UPDATE SET
  units = analytics_quota.units + excluded.units,
  bytes = analytics_quota.bytes + excluded.bytes
WHERE analytics_quota.units + excluded.units <= ?5
  AND analytics_quota.bytes + excluded.bytes <= ?6
RETURNING units, bytes`

function refuse(status: number): Response {
  return Response.json(
    { ok: false },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...(status === 429 ? { "Retry-After": "3600" } : {}),
      },
    }
  )
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

/** URLs anywhere in events/replay may carry signed draft links or OAuth codes. */
function redact(value: string): string {
  if (value.includes("?")) {
    try {
      const url = new URL(value)
      let touched = false
      for (const key of [...url.searchParams.keys()]) {
        if (/^(?:token|preview|code|access_token|refresh_token|id_token)$/i.test(key)) {
          url.searchParams.set(key, "redacted")
          touched = true
        }
      }
      if (touched) value = url.toString()
    } catch {
      // Replay also contains serialized HTML/CSS and relative URL strings.
    }
  }
  return value.replace(
    /([?&](?:amp;)?(?:token|preview|code|access_token|refresh_token|id_token)=)[^&#\s"'<>]*/gi,
    "$1redacted"
  )
}
function sanitize(value: unknown, token: string, depth = 0, budget = { nodes: 0 }): unknown {
  if (++budget.nodes > 100_000) throw new RequestError(413, "Invalid analytics data.")
  if (depth > 128) throw new RequestError(400, "Invalid analytics data.")
  if (typeof value === "string") return redact(value.split(token).join(ANALYTICS_GATEWAY_TOKEN))
  if (Array.isArray(value)) return value.map((item) => sanitize(item, token, depth + 1, budget))
  if (object(value)) {
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>
    for (const [key, item] of Object.entries(value)) {
      if (key.length > 256 || key === "__proto__" || key === "constructor" || key === "prototype")
        throw new RequestError(400, "Invalid analytics data.")
      // The browser cannot choose an ingestion project, even in a nested SDK property.
      result[key.split(token).join(ANALYTICS_GATEWAY_TOKEN)] =
        key === "token" || key === "api_key"
          ? ANALYTICS_GATEWAY_TOKEN
          : sanitize(item, token, depth + 1, budget)
    }
    return result
  }
  return value
}

async function decodeRequest(request: Request, max: number): Promise<unknown> {
  let body = await readBoundedBody(request, max)
  const url = new URL(request.url)
  const compression = url.searchParams.get("compression")
  const encoding = request.headers.get("content-encoding")
  if (encoding && encoding !== "gzip") throw new RequestError(415, "Unsupported compression.")
  // Current SDK gzip has magic bytes and text/plain without a compression query.
  if (encoding === "gzip" || compression === "gzip-js" || (body[0] === 0x1f && body[1] === 0x8b)) {
    const stream = new Blob([body]).stream().pipeThrough(new DecompressionStream("gzip"))
    body = await readBoundedBody(
      new Request(request.url, { method: "POST", body: stream, duplex: "half" } as RequestInit),
      max
    )
  } else if (compression && compression !== "base64") {
    throw new RequestError(415, "Unsupported compression.")
  }
  let text = decoder.decode(body)
  if (mediaTypeOf(request) === "application/x-www-form-urlencoded") {
    const data = new URLSearchParams(text).get("data")
    if (!data) throw new RequestError(400, "Missing analytics data.")
    text = data
    if (compression === "base64") {
      const binary = atob(data)
      const decoded = Uint8Array.from(binary, (char) => char.charCodeAt(0))
      if (decoded.byteLength > max) throw new RequestError(413, "Analytics data too large.")
      text = decoder.decode(decoded)
    }
  } else if (!["application/json", "text/plain"].includes(mediaTypeOf(request))) {
    throw new RequestError(415, "Unsupported analytics data.")
  }
  return JSON.parse(text) as unknown
}

function classify(path: string): Category | null {
  if (path === "/i/v0/e/" || path === "/e/") return "events"
  if (path === "/s/") return "replay"
  if (path === "/flags/") return "flags"
  if (
    path === `/array/${ANALYTICS_GATEWAY_TOKEN}/config` ||
    path === `/array/${ANALYTICS_GATEWAY_TOKEN}/config.js`
  )
    return "config"
  if (ASSETS.test(path)) return "assets"
  return null
}

function sameSiteGet(request: Request): boolean {
  const origin = new URL(request.url).origin
  if (request.headers.get("origin") === origin) return true
  if (request.headers.get("sec-fetch-site") === "same-origin") return true
  try {
    return new URL(request.headers.get("referer") ?? "").origin === origin
  } catch {
    return false
  }
}

function eventsFor(payload: unknown, replay: boolean): Record<string, unknown>[] {
  const batch = Array.isArray(payload) ? payload : [payload]
  if (batch.length === 0 || batch.length > 50)
    throw new RequestError(400, "Invalid analytics batch.")
  for (const event of batch) {
    if (
      !object(event) ||
      !object(event.properties) ||
      typeof event.event !== "string" ||
      "batch" in event
    )
      throw new RequestError(400, "Invalid analytics event.")
    if (replay ? event.event !== "$snapshot" : !EVENTS.has(event.event))
      throw new RequestError(400, "Event is not allowed.")
    if (
      typeof event.properties.distinct_id !== "string" ||
      event.properties.distinct_id.length > 256 ||
      !event.properties.distinct_id
    )
      throw new RequestError(400, "Invalid visitor identifier.")
    if (
      replay &&
      (!Array.isArray(event.properties.$snapshot_data) ||
        typeof event.properties.$session_id !== "string" ||
        !event.properties.$session_id ||
        event.properties.$session_id.length > 256)
    )
      throw new RequestError(400, "Invalid replay data.")
    if (replay) {
      for (const snapshot of event.properties.$snapshot_data as unknown[]) {
        // Nested SDK gzip hides URL-bearing DOM attributes from sanitization.
        if (!object(snapshot) || "cv" in snapshot || !object(snapshot.data))
          throw new RequestError(400, "Compressed replay data is not allowed.")
      }
    }
  }
  return batch as Record<string, unknown>[]
}

/** Fail closed: public anonymous telemetry has no right to consume an uncapped quota. */
export async function handleAnalyticsGateway(request: Request): Promise<Response> {
  const url = new URL(request.url)
  if (!url.pathname.startsWith(`${ANALYTICS_GATEWAY_PATH}/`)) return refuse(404)
  const path = url.pathname.slice(ANALYTICS_GATEWAY_PATH.length)
  const category = classify(path)
  if (!category) return refuse(404)
  const get = category === "config" || category === "assets"
  if (request.method !== (get ? "GET" : "POST")) return refuse(405)
  const token = serverEnv("POSTHOG_PROJECT_TOKEN")?.trim()
  const host = serverEnv("POSTHOG_HOST")?.trim() ?? "https://us.i.posthog.com"
  const assets = REGIONS[host]
  const env = getRuntimeEnv()
  const db = env.NEXT_TAG_CACHE_D1 as D1Database | undefined
  const limiter = env.RATE_LIMIT_API as RateLimit | undefined
  if (
    !token ||
    token === ANALYTICS_GATEWAY_TOKEN ||
    !/^phc_[A-Za-z0-9_-]+$/.test(token) ||
    !assets ||
    !db ||
    !limiter
  )
    return refuse(503)
  try {
    if (get ? !sameSiteGet(request) : (assertSameOrigin(request), false)) return refuse(403)
    const ip = request.headers.get("cf-connecting-ip")
    // Missing identity must not collapse into an unlimited bypass in previews/local runs.
    if (!ip || !(await limiter.limit({ key: `analytics:${ip}` })).success) return refuse(429)
    let body: string | undefined
    let units = 1
    let sessions: string[] = []
    if (!get) {
      let payload: unknown
      try {
        payload = await decodeRequest(request, category === "replay" ? MAX_REPLAY_BODY : MAX_BODY)
      } catch (error) {
        if (error instanceof RequestError) throw error
        throw new RequestError(400, "Invalid analytics data.")
      }
      const envelope = category !== "flags" && object(payload) && "batch" in payload
      const data = envelope && object(payload) ? payload.batch : payload
      if (envelope && !Array.isArray(data)) return refuse(400)
      if (
        envelope &&
        object(payload) &&
        payload.sent_at !== undefined &&
        (typeof payload.sent_at !== "string" || payload.sent_at.length > 128)
      )
        return refuse(400)
      if (category === "flags") {
        if (
          !object(data) ||
          typeof data.distinct_id !== "string" ||
          data.distinct_id.length > 256 ||
          !data.distinct_id
        )
          return refuse(400)
      } else {
        units = eventsFor(data, category === "replay").length
      }
      const safe = sanitize(data, token)
      if (category === "flags" && object(safe)) {
        safe.token = token
        delete safe.api_key
      } else {
        for (const event of Array.isArray(safe) ? safe : [safe]) {
          if (object(event) && object(event.properties)) {
            event.properties.token = token
            event.properties.$ip = ip
            if (category === "replay") sessions.push(String(event.properties.$session_id))
            // Only the enclosing SDK wrapper may contain batch/project credentials.
            delete event.token
            delete event.api_key
            delete event.$set
            delete event.$set_once
            if (category === "events") {
              event.properties.$process_person_profile = false
              delete event.properties.$set
              delete event.properties.$set_once
              delete event.properties.$groups
            }
          }
        }
      }
      // The installed SDK sends {api_key,batch,sent_at}, including for replay.
      // Preserve that wire contract, while excluding unvalidated wrapper fields.
      body = JSON.stringify(
        envelope && object(payload)
          ? {
              api_key: token,
              batch: safe,
              ...(typeof payload.sent_at === "string" ? { sent_at: payload.sent_at } : {}),
            }
          : safe
      )
      if (encoder.encode(body).byteLength > (category === "replay" ? MAX_REPLAY_BODY : MAX_BODY))
        return refuse(413)
    }
    const budget = LIMITS[category]
    // GET reserves the entire maximum response before dispatch; no refunds on errors.
    const bytes = body
      ? encoder.encode(body).byteLength
      : category === "assets"
        ? MAX_RESPONSE
        : 128 * 1024
    const limitName = `POSTHOG_MONTHLY_${category.toUpperCase()}_LIMIT`
    // Operator limits may reduce the hard ceiling, never disable or raise it by typo.
    const limit = monthlyLimit(limitName, budget.units)
    const month = new Date().toISOString().slice(0, 7)
    if (category === "replay") {
      const recordingLimit = monthlyLimit("POSTHOG_MONTHLY_RECORDINGS_LIMIT", MAX_RECORDINGS)
      if (recordingLimit === 0) return refuse(429)
      sessions = [...new Set(sessions)]
      const ids = JSON.stringify(sessions)
      const result = await db.batch<{ missing: number }>([
        db.prepare(REPLAY_ADMISSION_SQL).bind(month, ids, recordingLimit),
        db.prepare(REPLAY_MISSING_SQL).bind(month, ids),
      ])
      if (result[1]?.results[0]?.missing !== 0) return refuse(429)
    }
    const reserved = await db
      .prepare(ANALYTICS_QUOTA_RESERVATION_SQL)
      .bind(month, category, units, bytes, limit, budget.bytes)
      .first()
    if (!reserved) return refuse(429)
    const upstreamPath =
      category === "config"
        ? path.replace(ANALYTICS_GATEWAY_TOKEN, token).replace(/\.js$/, "")
        : path
    const upstream = new URL(upstreamPath, get ? assets : host)
    // Only SDK protocol versions survive. Client tokens, hosts and redirects never do.
    const version = url.searchParams.get("v")
    if (version && /^\d+(?:\.\d+){0,2}$/.test(version)) upstream.searchParams.set("v", version)
    const response = await fetch(upstream, {
      method: request.method,
      body,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: body ? { "Content-Type": "application/json" } : {},
    })
    if (!response.ok) {
      await response.body?.cancel().catch(() => {})
      return refuse(502)
    }
    if (!get && category !== "flags") {
      await response.body?.cancel().catch(() => {})
      return Response.json({ status: 1 }, { headers: { "Cache-Control": "no-store" } })
    }
    const raw = await readBoundedBody(
      new Request(request.url, {
        method: "POST",
        body: response.body,
        duplex: "half",
      } as RequestInit),
      category === "assets" ? MAX_RESPONSE : 128 * 1024
    )
    const text = decoder.decode(raw).split(token).join(ANALYTICS_GATEWAY_TOKEN)
    if (category === "assets") {
      if (
        !/^(?:application|text)\/(?:javascript|x-javascript)/i.test(
          response.headers.get("content-type") ?? ""
        )
      )
        return refuse(502)
      return new Response(text, {
        headers: {
          "Content-Type": "text/javascript; charset=utf-8",
          "Cache-Control": "private, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      })
    }
    const config = JSON.parse(text) as unknown
    if (!object(config)) return refuse(502)
    const sanitized = sanitize(config, token)
    if (category === "config" && path.endsWith(".js")) {
      const json = JSON.stringify(sanitized).replace(/</g, "\\u003c")
      return new Response(
        `window._POSTHOG_REMOTE_CONFIG=window._POSTHOG_REMOTE_CONFIG||{};window._POSTHOG_REMOTE_CONFIG[${JSON.stringify(ANALYTICS_GATEWAY_TOKEN)}]={config:${json}};`,
        {
          headers: {
            "Content-Type": "text/javascript; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        }
      )
    }
    return Response.json(sanitized, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return refuse(error instanceof RequestError ? error.status : 502)
  }
}
