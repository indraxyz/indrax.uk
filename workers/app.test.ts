import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  builtOrigin: "https://develop.previews.indrax.uk",
  getDb: vi.fn(),
  storage: vi.fn(),
  cleanup: vi.fn(),
}))
vi.mock("../config/site", () => ({
  PRODUCTION_SITE_URL: "https://indrax.uk",
  SITE_INDEXABLE: false,
  get SITE_URL() {
    return mocks.builtOrigin
  },
}))
vi.mock("../lib/db/index.server", () => ({ getDb: mocks.getDb }))
vi.mock("../lib/cover-storage.server", () => ({ getCoverStorageConfig: mocks.storage }))
vi.mock("../lib/media-cleanup.server", () => ({ runScheduledMediaCleanup: mocks.cleanup }))

import worker from "./app"

const origin = "https://develop.previews.indrax.uk"
const token = "worker-fixture-maintenance-token-0123456789"
// Only request context and the limiter are exercised here; other platform
// bindings deliberately remain absent so accidental access fails the test.
const context: Partial<ExecutionContext> = { waitUntil: vi.fn() }
// Wrangler generates SITE_URL from production and named environments, excluding
// Preview vars. The fixture also exercises that separate Preview configuration.
type TestEnv = Partial<Omit<CloudflareEnv, "SITE_URL">> & { SITE_URL: string }
function environment(): TestEnv {
  const bindings = {
    SITE_URL: origin,
    DATABASE_URL: "postgres://fixture.invalid/test",
    PREVIEW_MAINTENANCE_ENABLED: "true",
    PREVIEW_MAINTENANCE_TOKEN: token,
    RATE_LIMIT_STRICT: { limit: vi.fn(async () => ({ success: true })) },
  }
  return bindings
}
function request() {
  return new Request(`${origin}/api/internal/preview/media-cleanup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "cf-connecting-ip": "203.0.113.7",
    },
    body: "{}",
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.builtOrigin = origin
  mocks.getDb.mockReturnValue({})
  mocks.storage.mockReturnValue({ bucket: {}, publicUrl: "https://dev-media.indrax.uk" })
  mocks.cleanup.mockResolvedValue(undefined)
})

it("dispatches Preview maintenance before SSR and applies centralized headers", async () => {
  const env = environment()
  const response = await worker.fetch(request(), env as CloudflareEnv, context as ExecutionContext)
  expect(response.status).toBe(200)
  expect(mocks.cleanup).toHaveBeenCalledOnce()
  expect(env.RATE_LIMIT_STRICT?.limit).toHaveBeenCalledWith({
    key: "preview-maintenance:203.0.113.7",
  })
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow")
  expect(response.headers.get("x-content-type-options")).toBe("nosniff")
  expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'")
  expect(await response.json()).toEqual({ ok: true })
})

it("refuses rate-limited cleanup before accessing the database", async () => {
  const env = environment()
  vi.mocked(env.RATE_LIMIT_STRICT!.limit).mockResolvedValue({ success: false })
  const response = await worker.fetch(request(), env as CloudflareEnv, context as ExecutionContext)
  expect(response.status).toBe(429)
  expect(response.headers.get("retry-after")).toBe("60")
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(mocks.getDb).not.toHaveBeenCalled()
  expect(mocks.cleanup).not.toHaveBeenCalled()
})

it("a production build cannot expose the route through a forged staging URL", async () => {
  mocks.builtOrigin = "https://indrax.uk"
  const env = environment()
  vi.mocked(env.RATE_LIMIT_STRICT!.limit).mockResolvedValue({ success: false })
  const response = await worker.fetch(request(), env as CloudflareEnv, context as ExecutionContext)
  expect(response.status).toBe(404)
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(mocks.getDb).not.toHaveBeenCalled()
  expect(mocks.cleanup).not.toHaveBeenCalled()
  expect(env.RATE_LIMIT_STRICT?.limit).not.toHaveBeenCalled()
})

it("keeps the production Cron wired to the same awaited cleanup function", async () => {
  const env = environment()
  env.SITE_URL = "https://indrax.uk"
  await worker.scheduled(
    {} as ScheduledController,
    env as CloudflareEnv,
    context as ExecutionContext
  )
  expect(mocks.cleanup).toHaveBeenCalledOnce()
})
