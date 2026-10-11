import { expect, it, vi } from "vitest"
import { enforceRateLimit, rateLimitBucket } from "./edge-rate-limit"

const limiter = (success: boolean) => ({ limit: vi.fn(async () => ({ success })) })
const request = (path: string, headers: Record<string, string> = {}) =>
  new Request("https://example.test" + path, { headers })

it.each([
  ["/api/auth/sign-in/social", "RATE_LIMIT_STRICT", "auth"],
  ["/api/views/article", "RATE_LIMIT_STRICT", "views"],
  ["/api/admin/session", "RATE_LIMIT_API", "admin"],
  ["/api/admin/posts/archive", "RATE_LIMIT_API", "admin"],
  ["/api/upload", "RATE_LIMIT_API", "admin"],
  ["/api/writing/posts", "RATE_LIMIT_API", "writing"],
])("limits %s on %s as %s", (path, binding, bucket) => {
  expect(rateLimitBucket(path)).toEqual({ binding, bucket })
})

it.each(["/", "/writing", "/admin", "/robots.txt", "/api/uploads", "/.git/config"])(
  "leaves %s unlimited",
  (path) => expect(rateLimitBucket(path)).toBeNull()
)

it("keys the counter on the Cloudflare client IP, never a forwarding header", async () => {
  const strict = limiter(true)
  const result = await enforceRateLimit(
    request("/api/auth/get-session", {
      "cf-connecting-ip": "203.0.113.7",
      "x-forwarded-for": "198.51.100.1",
    }),
    "/api/auth/get-session",
    { RATE_LIMIT_STRICT: strict }
  )
  expect(result).toBeNull()
  expect(strict.limit).toHaveBeenCalledWith({ key: "auth:203.0.113.7" })
})

it("answers 429 with Retry-After once the limiter refuses", async () => {
  const result = await enforceRateLimit(
    request("/api/admin/session", { "cf-connecting-ip": "203.0.113.7" }),
    "/api/admin/session",
    { RATE_LIMIT_API: limiter(false) }
  )
  expect(result?.status).toBe(429)
  expect(result?.headers.get("Retry-After")).toBe("60")
  expect(result?.headers.get("Cache-Control")).toBe("no-store")
  expect(await result?.json()).toMatchObject({ ok: false })
})

it("passes through without a client IP or a configured binding", async () => {
  const api = limiter(false)
  expect(
    await enforceRateLimit(request("/api/admin/session"), "/api/admin/session", {
      RATE_LIMIT_API: api,
    })
  ).toBeNull()
  expect(api.limit).not.toHaveBeenCalled()
  expect(
    await enforceRateLimit(
      request("/api/admin/session", { "cf-connecting-ip": "203.0.113.7" }),
      "/api/admin/session",
      {}
    )
  ).toBeNull()
})

it.each(["127.0.0.1", "::1"])(
  "never limits loopback (%s), which only local Workerd reports",
  async (ip) => {
    const api = limiter(false)
    expect(
      await enforceRateLimit(
        request("/api/writing/posts", { "cf-connecting-ip": ip }),
        "/api/writing/posts",
        {
          RATE_LIMIT_API: api,
        }
      )
    ).toBeNull()
    expect(api.limit).not.toHaveBeenCalled()
  }
)
