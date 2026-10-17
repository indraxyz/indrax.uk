import { readFileSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"
import { gzipSync } from "node:zlib"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ANALYTICS_GATEWAY_TOKEN } from "./analytics-gateway"
import { ANALYTICS_QUOTA_RESERVATION_SQL, handleAnalyticsGateway } from "./analytics-gateway.server"
import { runWithRequest, type RuntimeEnv } from "./runtime.server"
import { sqliteQuotaBinding } from "./analytics-gateway.test-support"

const TOKEN = "phc_private_project_token"
const origin = "https://indrax.uk"
const event = (name = "$pageview") => ({
  event: name,
  properties: {
    distinct_id: "anonymous-visitor",
    token: "phc_client_chosen",
    $current_url: `${origin}/writing/example?preview=secret-preview&token=secret-token`,
  },
})
const point = (type = "click") => ({ x: -1.25, y: 20.5, target_fixed: false, type })
const heatmap = (data: unknown = { [origin]: [point()] }) => ({
  event: "$$heatmap",
  properties: { distinct_id: "anonymous-visitor", $heatmap_data: data },
})
const snapshot = (session = "session") => ({
  event: "$snapshot",
  properties: {
    distinct_id: "visitor",
    $session_id: session,
    $snapshot_data: [{ type: 2, data: { node: { type: 2, childNodes: [] } } }],
  },
})
let sqlite: DatabaseSync
let env: RuntimeEnv
let upstream: ReturnType<typeof vi.fn>

function request(path: string, data: unknown = event(), extra: RequestInit = {}) {
  return new Request(`${origin}/analytics${path}`, {
    method: "POST",
    body: JSON.stringify(data),
    ...extra,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.1",
      ...extra.headers,
    },
  })
}
function get(path: string) {
  return new Request(`${origin}/analytics${path}`, {
    headers: { "Sec-Fetch-Site": "same-origin", "CF-Connecting-IP": "203.0.113.1" },
  })
}
const handle = (req: Request) =>
  runWithRequest(req, env, undefined, () => handleAnalyticsGateway(req))

beforeEach(() => {
  sqlite = new DatabaseSync(":memory:")
  sqlite.exec(readFileSync(new URL("../config/analytics-quota.sql", import.meta.url), "utf8"))
  env = {
    POSTHOG_PROJECT_TOKEN: TOKEN,
    POSTHOG_HOST: "https://us.i.posthog.com",
    APP_D1: sqliteQuotaBinding(sqlite),
    RATE_LIMIT_API: { limit: vi.fn().mockResolvedValue({ success: true }) },
  }
  upstream = vi.fn().mockImplementation(async () => Response.json({ status: 1 }))
  vi.stubGlobal("fetch", upstream)
})
afterEach(() => {
  sqlite.close()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("protected PostHog gateway", () => {
  it("accepts only the /analytics namespace and refuses the retired API gateway path", async () => {
    expect((await handle(request("/e/"))).status).toBe(200)
    upstream.mockClear()
    for (const path of ["/api/analytics/e/", "/analytics-other/e/", "/analytics"]) {
      const response = await handle(
        new Request(`${origin}${path}`, {
          method: "POST",
          headers: {
            Origin: origin,
            "Content-Type": "application/json",
            "CF-Connecting-IP": "203.0.113.1",
          },
          body: JSON.stringify(event()),
        })
      )
      expect(response.status).toBe(404)
    }
    expect(upstream).not.toHaveBeenCalled()
  })

  it("forwards SDK heatmaps in mixed batches and reserves one event unit per envelope", async () => {
    env.POSTHOG_MONTHLY_EVENTS_LIMIT = "2"
    const coordinates = ["click", "mousemove", "rageclick", "deadclick"].map(point)
    const response = await handle(
      request("/i/v0/e/", {
        api_key: "attacker",
        batch: [event(), heatmap({ [origin]: coordinates })],
      })
    )
    expect(response.status).toBe(200)
    const data = JSON.parse(upstream.mock.calls[0][1].body)
    expect(data.api_key).toBe(TOKEN)
    expect(data.batch[1].properties.$heatmap_data).toEqual({ [origin]: coordinates })
    expect(data.batch[1].properties.token).toBe(TOKEN)
    expect(data.batch[1].properties.$ip).toBe("203.0.113.1")
    expect(
      sqlite.prepare("SELECT units, bytes FROM analytics_quota WHERE category='events'").get()
    ).toEqual({
      units: 2,
      bytes: new TextEncoder().encode(upstream.mock.calls[0][1].body).byteLength,
    })
    expect((await handle(request("/i/v0/e/", heatmap()))).status).toBe(429)
  })

  it("redacts URL keys server-side, merging points without losing signed-link groups", async () => {
    const first = `${origin}/preview?token=one&code=first`
    const second = `${origin}/preview?token=two&code=second`
    expect(
      (
        await handle(
          request("/e/", heatmap({ [first]: [point()], [second]: [point("mousemove")] }))
        )
      ).status
    ).toBe(200)
    const body = upstream.mock.calls[0][1].body as string
    expect(body).not.toMatch(/token=one|token=two|code=first|code=second/)
    expect(JSON.parse(body).properties.$heatmap_data).toEqual({
      [`${origin}/preview?token=redacted&code=redacted`]: [point(), point("mousemove")],
    })
  })

  it("accepts long heatmap URLs while retaining normal property-key bounds", async () => {
    const page = `${origin}/writing/${"a".repeat(512)}?preview=bearer`
    expect((await handle(request("/e/", heatmap({ [page]: [point()] })))).status).toBe(200)
    expect(
      Object.keys(JSON.parse(upstream.mock.calls[0][1].body).properties.$heatmap_data)
    ).toEqual([page.replace("bearer", "redacted")])
    expect(
      (
        await handle(
          request("/e/", {
            ...heatmap(),
            properties: { ...heatmap().properties, ["a".repeat(257)]: "invalid" },
          })
        )
      ).status
    ).toBe(400)
  })

  it.each([
    null,
    [],
    {},
    { relative: [point()] },
    { "javascript:alert(1)": [point()] },
    { [origin]: [] },
    { [origin]: {} },
    { [origin]: [{ ...point(), x: "1" }] },
    { [origin]: [{ ...point(), y: null }] },
    { [origin]: [{ ...point(), target_fixed: 1 }] },
    { [origin]: [{ ...point(), type: "scroll" }] },
    { [origin]: [{ ...point(), text: "private DOM text" }] },
    { [origin]: [{ x: 1, y: 2, type: "click" }] },
    { [`${origin}/${"a".repeat(8192)}`]: [point()] },
  ])("refuses malformed heatmap data before quota reservation: %j", async (data) => {
    expect(
      (await handle(request("/e/", { api_key: "attacker", batch: [event(), heatmap(data)] })))
        .status
    ).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
    expect(sqlite.prepare("SELECT COUNT(*) AS total FROM analytics_quota").get()).toEqual({
      total: 0,
    })
  })

  it("enforces the existing body ceiling on heatmap batches", async () => {
    const data = { [origin]: Array.from({ length: 20000 }, () => point()) }
    expect((await handle(request("/e/", heatmap(data)))).status).toBe(413)
    expect(upstream).not.toHaveBeenCalled()
  })

  it("does not grant heatmap URL-key bounds to nested objects in other events", async () => {
    const data = event()
    Object.assign(data.properties, {
      nested: heatmap({ [`${origin}/${"a".repeat(512)}`]: [point()] }),
    })
    expect((await handle(request("/e/", data))).status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })

  it("rejects non-finite JSON heatmap coordinates", async () => {
    const body = `{"event":"$$heatmap","properties":{"distinct_id":"visitor","$heatmap_data":{"${origin}":[{"x":1e309,"y":2,"target_fixed":false,"type":"click"}]}}}`
    expect((await handle(request("/e/", undefined, { body }))).status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })

  it("merges many URL aliases without dropping or reordering coordinates", async () => {
    const data = Object.fromEntries(
      Array.from({ length: 1000 }, (_, x) => [`${origin}/?token=${x}`, [{ ...point(), x }]])
    )
    expect((await handle(request("/e/", heatmap(data)))).status).toBe(200)
    const groups = JSON.parse(upstream.mock.calls[0][1].body).properties.$heatmap_data
    expect(Object.keys(groups)).toEqual([`${origin}/?token=redacted`])
    expect(groups[`${origin}/?token=redacted`].map((entry: { x: number }) => entry.x)).toEqual(
      Array.from({ length: 1000 }, (_, x) => x)
    )
  })

  it("preserves native scroll-depth and dead-swipe metadata in ordinary mixed batches", async () => {
    const scroll = {
      $prev_pageview_pathname: "/writing",
      $prev_pageview_max_scroll: 800,
      $prev_pageview_max_scroll_percentage: 0.8,
      $prev_pageview_last_scroll: 400,
      $prev_pageview_last_scroll_percentage: 0.4,
      $prev_pageview_max_content: 1000,
      $prev_pageview_max_content_percentage: 1,
      $prev_pageview_last_content: 600,
      $prev_pageview_last_content_percentage: 0.6,
    }
    const swipe = {
      $dead_swipe_direction: "right",
      $dead_swipe_distance_px: 130.5,
      $dead_swipe_absolute_delay_ms: 2200,
    }
    const payload = [
      { ...event("$pageleave"), properties: { ...event().properties, ...scroll } },
      { ...event("$dead_swipe"), properties: { ...event().properties, ...swipe } },
      heatmap(),
    ]
    expect(
      (await handle(request("/i/v0/e/", { api_key: "attacker", batch: payload }))).status
    ).toBe(200)
    const data = JSON.parse(upstream.mock.calls[0][1].body).batch
    expect(data[0].properties).toMatchObject(scroll)
    expect(data[1].properties).toMatchObject(swipe)
    expect(
      sqlite.prepare("SELECT units FROM analytics_quota WHERE category='events'").get()
    ).toEqual({ units: 3 })
  })

  it.each([301, 302, 303, 307, 308])(
    "refuses upstream redirects (%s) without forwarding credentials",
    async (status) => {
      upstream.mockResolvedValue(
        new Response(null, {
          status,
          headers: { Location: "https://untrusted.example/collect" },
        })
      )
      const response = await handle(request("/e/"))
      expect(response.status).toBe(502)
      expect(response.headers.has("location")).toBe(false)
      expect(await response.json()).toEqual({ ok: false })
      expect(upstream).toHaveBeenCalledTimes(1)
      expect(upstream.mock.calls[0][1].redirect).toBe("manual")
    }
  )

  it("forwards allowlisted events with only the server token and redacts bearer URLs", async () => {
    const response = await handle(
      request("/i/v0/e/?token=attacker&api_key=attacker&v=1", [event(), event("contact_clicked")])
    )
    expect(response.status).toBe(200)
    const [url, init] = upstream.mock.calls[0] as [URL, RequestInit]
    expect(url.toString()).toBe("https://us.i.posthog.com/i/v0/e/?v=1")
    const body = JSON.parse(init.body as string)
    expect(body).toHaveLength(2)
    expect(body[0].properties.token).toBe(TOKEN)
    expect(body[0].properties.$ip).toBe("203.0.113.1")
    expect(body[0].properties.$current_url).toContain("preview=redacted&token=redacted")
    expect(init.headers).toEqual({ "Content-Type": "application/json" })
    expect(init.redirect).toBe("manual")
    expect(await response.text()).not.toContain(TOKEN)
    expect(
      sqlite.prepare("SELECT units FROM analytics_quota WHERE category='events'").get()
    ).toEqual({ units: 2 })
  })

  it("preserves and counts real SDK event envelopes, replacing the root project credential", async () => {
    env.POSTHOG_MONTHLY_EVENTS_LIMIT = "2"
    const payload = {
      api_key: "phc_browser_placeholder",
      batch: [event("$pageview"), event("$autocapture")],
      sent_at: "2026-10-14T00:00:00Z",
      unvalidated: { batch: [event()] },
    }
    expect((await handle(request("/e/", payload))).status).toBe(200)
    const forwarded = JSON.parse(upstream.mock.calls[0][1].body)
    expect(forwarded.api_key).toBe(TOKEN)
    expect(forwarded.batch).toHaveLength(2)
    expect(
      forwarded.batch.every(
        (entry: { properties: { token: string } }) => entry.properties.token === TOKEN
      )
    ).toBe(true)
    expect(forwarded.sent_at).toBe(payload.sent_at)
    expect(forwarded).not.toHaveProperty("unvalidated")
    expect((await handle(request("/e/", { api_key: "attacker", batch: [event()] }))).status).toBe(
      429
    )
    expect(
      sqlite.prepare("SELECT units FROM analytics_quota WHERE category='events'").get()
    ).toEqual({ units: 2 })
  })

  it("preserves real SDK replay envelopes and counts each snapshot envelope", async () => {
    env.POSTHOG_MONTHLY_REPLAY_LIMIT = "2"
    const snapshot = {
      event: "$snapshot",
      properties: {
        distinct_id: "visitor",
        $session_id: "session",
        $snapshot_data: [{ type: 2, data: { node: { type: 2, childNodes: [] } } }],
      },
    }
    expect(
      (
        await handle(
          request("/s/", {
            api_key: "attacker",
            batch: [snapshot, snapshot],
            sent_at: "2026-10-14T00:00:00Z",
          })
        )
      ).status
    ).toBe(200)
    const forwarded = JSON.parse(upstream.mock.calls[0][1].body)
    expect(forwarded.api_key).toBe(TOKEN)
    expect(forwarded.batch).toHaveLength(2)
    expect((await handle(request("/s/", { api_key: "attacker", batch: [snapshot] }))).status).toBe(
      429
    )
    expect(
      sqlite.prepare("SELECT units FROM analytics_quota WHERE category='replay'").get()
    ).toEqual({ units: 2 })
  })

  it("rejects nested alternate batches and invalid SDK envelopes before reserving quota", async () => {
    for (const payload of [
      { api_key: "attacker", batch: [{ ...event(), batch: [event()] }] },
      { api_key: "attacker", batch: event() },
      { api_key: "attacker", batch: [event()], sent_at: { value: "not a timestamp" } },
      { api_key: "attacker", batch: [] },
      { api_key: "attacker", batch: Array.from({ length: 51 }, () => event()) },
    ])
      expect((await handle(request("/e/", payload))).status).toBe(400)
    expect(sqlite.prepare("SELECT COUNT(*) AS count FROM analytics_quota").get()).toEqual({
      count: 0,
    })
    expect(upstream).not.toHaveBeenCalled()
  })

  it("accepts SDK base64 form beacons", async () => {
    const body = new URLSearchParams({
      data: Buffer.from(JSON.stringify([event()])).toString("base64"),
    }).toString()
    expect(
      (
        await handle(
          request("/e/?compression=base64", undefined, {
            body,
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
          })
        )
      ).status
    ).toBe(200)
    expect(JSON.parse(upstream.mock.calls[0][1].body)[0].properties.token).toBe(TOKEN)
  })

  it("accepts bounded gzip with the current SDK's text/plain content type", async () => {
    const compressed = new Uint8Array(gzipSync(JSON.stringify([event()])))
    const result = await handle(
      request("/e/", undefined, { body: compressed, headers: { "Content-Type": "text/plain" } })
    )
    expect(result.status).toBe(200)
    expect(JSON.parse(upstream.mock.calls[0][1].body)[0].event).toBe("$pageview")
  })

  it("preserves replay arrays while replacing credentials and redacting serialized DOM URLs", async () => {
    const replay = event("$snapshot")
    Object.assign(replay.properties, {
      $session_id: "session-id",
      $snapshot_data: [
        { type: 2, data: { node: { attributes: { href: `${origin}/?token=bearer` } } } },
      ],
    })
    expect((await handle(request("/s/", [replay]))).status).toBe(200)
    const forwarded = JSON.parse(upstream.mock.calls[0][1].body)[0]
    expect(forwarded.properties.$snapshot_data[0].data.node.attributes.href).toBe(
      `${origin}/?token=redacted`
    )
    expect(
      sqlite.prepare("SELECT units FROM analytics_quota WHERE category='replay'").get()
    ).toEqual({ units: 1 })
  })

  it("allows autocapture but refuses arbitrary event names and malformed replay", async () => {
    expect((await handle(request("/e/", event("$autocapture")))).status).toBe(200)
    upstream.mockClear()
    expect((await handle(request("/e/", event("$identify")))).status).toBe(400)
    expect((await handle(request("/s/", event("$snapshot")))).status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })

  it("refuses nested compressed replay and keeps the private key out of DOM attributes", async () => {
    const snapshot = (data: unknown, cv?: string) => ({
      event: "$snapshot",
      properties: {
        distinct_id: "visitor",
        $session_id: "session",
        $ip: "192.0.2.100",
        $snapshot_data: [{ type: 2, data, ...(cv ? { cv } : {}) }],
      },
    })
    expect(
      (await handle(request("/s/", snapshot("compressed-secret-data", "2024-10")))).status
    ).toBe(400)
    expect(
      (await handle(request("/s/", snapshot({ attributes: "compressed-secret-data" }, "2024-10"))))
        .status
    ).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
    expect(
      (
        await handle(
          request("/s/", snapshot({ node: { attributes: { token: "browser-chosen-token" } } }))
        )
      ).status
    ).toBe(200)
    const payload = JSON.parse(upstream.mock.calls[0][1].body)
    expect(payload.properties.token).toBe(TOKEN)
    expect(payload.properties.$ip).toBe("203.0.113.1")
    expect(payload.properties.$snapshot_data[0].data.node.attributes.token).toBe(
      ANALYTICS_GATEWAY_TOKEN
    )
  })

  it("validates flags and sanitizes tokens in parsed responses, including JSON escapes", async () => {
    upstream.mockResolvedValue(
      new Response(
        '{"featureFlags":{"example":true},"api_key":"phc_\\u0070rivate_project_token"}',
        { headers: { "Content-Type": "application/json" } }
      )
    )
    const result = await handle(
      request("/flags/?v=2", {
        token: "attacker",
        distinct_id: "visitor",
        person_properties: { initial_url: `${origin}/?code=oauth-code` },
      })
    )
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({
      featureFlags: { example: true },
      api_key: ANALYTICS_GATEWAY_TOKEN,
    })
    const payload = JSON.parse(upstream.mock.calls[0][1].body)
    expect(payload.token).toBe(TOKEN)
    expect(payload.person_properties.initial_url).toBe(`${origin}/?code=redacted`)
  })

  it("provides replay configuration without returning the private token or executing upstream JavaScript", async () => {
    upstream.mockResolvedValue(Response.json({ sessionRecording: { enabled: true }, token: TOKEN }))
    const response = await handle(get(`/array/${ANALYTICS_GATEWAY_TOKEN}/config.js`))
    expect(response.status).toBe(200)
    expect(upstream.mock.calls[0][0].toString()).toBe(
      `https://us-assets.i.posthog.com/array/${TOKEN}/config`
    )
    const script = await response.text()
    expect(script).toContain(`window._POSTHOG_REMOTE_CONFIG["${ANALYTICS_GATEWAY_TOKEN}"]`)
    expect(script).toContain('"sessionRecording":{"enabled":true}')
    expect(script).not.toContain(TOKEN)
  })

  it.each(["web-vitals", "web-vitals-with-attribution", "dead-clicks-autocapture"])(
    "serves versioned and fallback %s assets as JavaScript within the shared quota",
    async (name) => {
      upstream.mockImplementation(
        async () =>
          new Response("/* SDK asset */", {
            headers: { "Content-Type": "application/javascript" },
          })
      )
      for (const path of [`/static/1.434.18/${name}.js`, `/static/${name}.js?v=1.434.18`]) {
        const response = await handle(get(path))
        expect(response.status).toBe(200)
        expect(response.headers.get("content-type")).toBe("text/javascript; charset=utf-8")
        expect(response.headers.get("x-content-type-options")).toBe("nosniff")
        expect(upstream.mock.calls.at(-1)?.[0].toString()).toBe(
          `https://us-assets.i.posthog.com${path}`
        )
      }
      expect(
        sqlite.prepare("SELECT units FROM analytics_quota WHERE category='assets'").get()
      ).toEqual({ units: 2 })
    }
  )

  it("refuses JSON responses for supported SDK scripts and unsupported asset names", async () => {
    upstream.mockResolvedValue(Response.json({ ok: false }))
    expect((await handle(get("/static/web-vitals-with-attribution.js"))).status).toBe(502)
    for (const path of [
      "/static/surveys.js",
      "/static/anything.js",
      "/static/1.434.18/evil.js",
      "/static/1.434.18/nested/web-vitals.js",
    ])
      expect((await handle(get(path))).status).toBe(404)
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it("allows only supported SDK assets and fixed regional hosts", async () => {
    env.POSTHOG_HOST = "https://eu.i.posthog.com"
    upstream.mockResolvedValue(
      new Response("window.recorder = true", {
        headers: { "Content-Type": "application/javascript" },
      })
    )
    expect((await handle(get("/static/1.434.14/lazy-recorder.js"))).status).toBe(200)
    expect(upstream.mock.calls[0][0].toString()).toBe(
      "https://eu-assets.i.posthog.com/static/1.434.14/lazy-recorder.js"
    )
    expect((await handle(get("/static/anything.js"))).status).toBe(404)
    env.POSTHOG_HOST = "https://attacker.example"
    expect((await handle(request("/e/"))).status).toBe(503)
  })

  it("fails closed for absent infrastructure, missing identity, cross-origin and storage failures", async () => {
    for (const key of ["POSTHOG_PROJECT_TOKEN", "APP_D1", "RATE_LIMIT_API"]) {
      const original = env[key]
      delete env[key]
      expect((await handle(request("/e/"))).status).toBe(503)
      env[key] = original
    }
    const anonymous = request("/e/")
    anonymous.headers.delete("CF-Connecting-IP")
    expect((await handle(anonymous)).status).toBe(429)
    expect(
      (await handle(request("/e/", event(), { headers: { Origin: "https://attacker.example" } })))
        .status
    ).toBe(403)
    expect(
      (await handle(new Request(`${origin}/analytics/array/${ANALYTICS_GATEWAY_TOKEN}/config`)))
        .status
    ).toBe(403)
    env.APP_D1 = {
      prepare() {
        throw new Error("Storage is unavailable")
      },
    }
    expect((await handle(request("/e/"))).status).toBe(502)
    expect(upstream).not.toHaveBeenCalled()
  })

  it("caps the entire batch atomically and keeps spent reservations after upstream errors", async () => {
    env.POSTHOG_MONTHLY_EVENTS_LIMIT = "2"
    upstream.mockResolvedValue(new Response(`Upstream leaked ${TOKEN}`, { status: 500 }))
    const first = await handle(request("/e/", [event(), event()]))
    expect(first.status).toBe(502)
    expect(await first.text()).not.toContain(TOKEN)
    expect((await handle(request("/e/"))).status).toBe(429)
    expect(upstream).toHaveBeenCalledTimes(1)
    expect(
      sqlite.prepare("SELECT units FROM analytics_quota WHERE category='events'").get()
    ).toEqual({ units: 2 })
  })

  it("does not exceed the shared SQL limit under concurrent requests", async () => {
    env.POSTHOG_MONTHLY_EVENTS_LIMIT = "10"
    const results = await Promise.all(Array.from({ length: 40 }, () => handle(request("/e/"))))
    expect(results.filter((response) => response.status === 200)).toHaveLength(10)
    expect(results.filter((response) => response.status === 429)).toHaveLength(30)
    expect(upstream).toHaveBeenCalledTimes(10)
    expect(
      sqlite.prepare("SELECT units FROM analytics_quota WHERE category='events'").get()
    ).toEqual({ units: 10 })
  })

  it.each(["events", "flags"])(
    "caps %s at its quarter-share of the free allowance",
    async (category) => {
      sqlite
        .prepare("INSERT INTO analytics_quota VALUES (?, ?, 249999, 0)")
        .run(new Date().toISOString().slice(0, 7), category)
      const req = () =>
        category === "events" ? request("/e/") : request("/flags/", { distinct_id: "visitor" })
      expect((await handle(req())).status).toBe(200)
      expect((await handle(req())).status).toBe(429)
      expect(upstream).toHaveBeenCalledTimes(1)
    }
  )

  it("counts distinct recordings and lets admitted sessions continue at the limit", async () => {
    env.POSTHOG_MONTHLY_RECORDINGS_LIMIT = "1"
    expect((await handle(request("/s/", [snapshot(), snapshot()]))).status).toBe(200)
    expect((await handle(request("/s/", snapshot()))).status).toBe(200)
    expect((await handle(request("/s/", snapshot("another-session")))).status).toBe(429)
    expect(sqlite.prepare("SELECT COUNT(*) AS total FROM analytics_replay_sessions").get()).toEqual(
      { total: 1 }
    )
    expect(
      sqlite.prepare("SELECT units FROM analytics_quota WHERE category='replay'").get()
    ).toEqual({ units: 3 })
    expect((await handle(request("/s/", snapshot("")))).status).toBe(400)
  })

  it("admits all new sessions in a batch or none, including mixtures with existing sessions", async () => {
    env.POSTHOG_MONTHLY_RECORDINGS_LIMIT = "2"
    expect((await handle(request("/s/", snapshot("one")))).status).toBe(200)
    expect(
      (await handle(request("/s/", [snapshot("one"), snapshot("two"), snapshot("three")]))).status
    ).toBe(429)
    expect(
      sqlite.prepare("SELECT session_id FROM analytics_replay_sessions ORDER BY session_id").all()
    ).toEqual([{ session_id: "one" }])
    expect((await handle(request("/s/", [snapshot("two"), snapshot("two")]))).status).toBe(200)
    expect((await handle(request("/s/", [snapshot("one"), snapshot("two")]))).status).toBe(200)
  })

  it("does not over-admit recordings under concurrent requests", async () => {
    env.POSTHOG_MONTHLY_RECORDINGS_LIMIT = "10"
    const results = await Promise.all(
      Array.from({ length: 40 }, (_, index) => handle(request("/s/", snapshot(`session-${index}`))))
    )
    expect(results.filter((response) => response.status === 200)).toHaveLength(10)
    expect(results.filter((response) => response.status === 429)).toHaveLength(30)
    expect(sqlite.prepare("SELECT COUNT(*) AS total FROM analytics_replay_sessions").get()).toEqual(
      { total: 10 }
    )
    expect(upstream).toHaveBeenCalledTimes(10)
  })

  it("limits each environment to 1250 admitted recordings while preserving continuation", async () => {
    const month = new Date().toISOString().slice(0, 7)
    sqlite
      .prepare(
        `WITH RECURSIVE slots(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM slots WHERE n < 1249)
      INSERT INTO analytics_replay_sessions SELECT ?, 'seed-' || n FROM slots`
      )
      .run(month)
    expect((await handle(request("/s/", snapshot("last-recording")))).status).toBe(200)
    expect((await handle(request("/s/", snapshot("overflow")))).status).toBe(429)
    expect((await handle(request("/s/", snapshot("last-recording")))).status).toBe(200)
    expect(sqlite.prepare("SELECT COUNT(*) AS total FROM analytics_replay_sessions").get()).toEqual(
      { total: 1250 }
    )
  })

  it("renews recording admission at UTC month rollover", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-31T23:59:59Z"))
    env.POSTHOG_MONTHLY_RECORDINGS_LIMIT = "1"
    expect((await handle(request("/s/", snapshot("one")))).status).toBe(200)
    expect((await handle(request("/s/", snapshot("two")))).status).toBe(429)
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"))
    expect((await handle(request("/s/", snapshot("two")))).status).toBe(200)
    expect(
      sqlite
        .prepare(
          "SELECT month, COUNT(*) AS total FROM analytics_replay_sessions GROUP BY month ORDER BY month"
        )
        .all()
    ).toEqual([
      { month: "2026-10", total: 1 },
      { month: "2026-11", total: 1 },
    ])
  })

  it("preserves recording reservations after upstream failures and enforces lower-only limits", async () => {
    env.POSTHOG_MONTHLY_RECORDINGS_LIMIT = "1"
    upstream.mockResolvedValue(new Response(null, { status: 500 }))
    expect((await handle(request("/s/", snapshot()))).status).toBe(502)
    expect((await handle(request("/s/", snapshot("another")))).status).toBe(429)
    env.POSTHOG_MONTHLY_RECORDINGS_LIMIT = "0"
    expect((await handle(request("/s/", snapshot()))).status).toBe(429)
    env.POSTHOG_MONTHLY_RECORDINGS_LIMIT = "1251"
    expect((await handle(request("/s/", snapshot()))).status).toBe(503)
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it("fails closed when recording storage is absent", async () => {
    sqlite.exec("DROP TABLE analytics_replay_sessions")
    expect((await handle(request("/s/", snapshot()))).status).toBe(502)
    expect(upstream).not.toHaveBeenCalled()
  })

  it("resets quotas only at UTC month rollover", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-10-31T23:59:59Z"))
    env.POSTHOG_MONTHLY_EVENTS_LIMIT = "1"
    expect((await handle(request("/e/"))).status).toBe(200)
    expect((await handle(request("/e/"))).status).toBe(429)
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"))
    expect((await handle(request("/e/"))).status).toBe(200)
    expect(sqlite.prepare("SELECT month, units FROM analytics_quota ORDER BY month").all()).toEqual(
      [
        { month: "2026-10", units: 1 },
        { month: "2026-11", units: 1 },
      ]
    )
  })

  it("reserves the config response ceiling without prematurely exhausting its 10000-request budget", async () => {
    const month = new Date().toISOString().slice(0, 7)
    sqlite
      .prepare("INSERT INTO analytics_quota VALUES (?, 'config', 9999, ?)")
      .run(month, 9999 * 128 * 1024)
    upstream.mockImplementation(async () => Response.json({ sessionRecording: { enabled: true } }))
    expect((await handle(get(`/array/${ANALYTICS_GATEWAY_TOKEN}/config`))).status).toBe(200)
    expect((await handle(get(`/array/${ANALYTICS_GATEWAY_TOKEN}/config`))).status).toBe(429)
    expect(
      sqlite.prepare("SELECT units, bytes FROM analytics_quota WHERE category='config'").get()
    ).toEqual({ units: 10000, bytes: 10000 * 128 * 1024 })
  })

  it("preserves normal nested replay DOM data within the bounded traversal budget", async () => {
    let node: unknown = { type: 3, textContent: "Public text" }
    for (let index = 0; index < 40; index++) node = { type: 2, childNodes: [node] }
    const snapshot = {
      event: "$snapshot",
      properties: {
        distinct_id: "visitor",
        $session_id: "session",
        $snapshot_data: [{ type: 2, data: { node } }],
      },
    }
    expect((await handle(request("/s/", snapshot))).status).toBe(200)
    expect(JSON.parse(upstream.mock.calls[0][1].body).properties.$snapshot_data).toEqual(
      snapshot.properties.$snapshot_data
    )
  })

  it("enforces byte ceilings atomically as well as units", () => {
    const reserve = sqlite.prepare(ANALYTICS_QUOTA_RESERVATION_SQL)
    expect(reserve.get("2026-10", "events", 1, 8, 100, 10)).toEqual({ units: 1, bytes: 8 })
    expect(reserve.get("2026-10", "events", 1, 3, 100, 10)).toBeUndefined()
    expect(reserve.get("2026-11", "events", 1, 8, 100, 10)).toEqual({ units: 1, bytes: 8 })
    expect(reserve.get("2026-10", "flags", 1, 11, 100, 10)).toBeUndefined()
  })

  it("rejects malformed, oversized and decompression-bomb bodies before forwarding", async () => {
    expect((await handle(request("/e/", undefined, { body: "{" }))).status).toBe(400)
    expect(
      (
        await handle(
          request(
            "/e/",
            Array.from({ length: 51 }, () => event())
          )
        )
      ).status
    ).toBe(400)
    const bomb = new Uint8Array(gzipSync(JSON.stringify({ padding: "x".repeat(1024 * 1024 + 1) })))
    expect(
      (
        await handle(
          request("/e/", undefined, { body: bomb, headers: { "Content-Type": "text/plain" } })
        )
      ).status
    ).toBe(413)
    expect(upstream).not.toHaveBeenCalled()
  })

  it("refuses token placeholders, invalid operator limits and limiter errors", async () => {
    env.POSTHOG_PROJECT_TOKEN = ANALYTICS_GATEWAY_TOKEN
    expect((await handle(request("/e/"))).status).toBe(503)
    env.POSTHOG_PROJECT_TOKEN = TOKEN
    env.POSTHOG_MONTHLY_EVENTS_LIMIT = "1000000000"
    expect((await handle(request("/e/"))).status).toBe(503)
    delete env.POSTHOG_MONTHLY_EVENTS_LIMIT
    env.RATE_LIMIT_API = { limit: vi.fn().mockRejectedValue(new Error("Unavailable")) }
    expect((await handle(request("/e/"))).status).toBe(502)
    expect(upstream).not.toHaveBeenCalled()
  })
})
