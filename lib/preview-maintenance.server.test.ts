import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  builtOrigin: "https://develop.previews.indrax.uk",
  getDb: vi.fn(),
  storage: vi.fn(),
  cleanup: vi.fn(),
}))
vi.mock("@/config/site", () => ({
  PRODUCTION_SITE_URL: "https://indrax.uk",
  get SITE_URL() {
    return mocks.builtOrigin
  },
}))
vi.mock("./db/index.server", () => ({ getDb: mocks.getDb }))
vi.mock("./cover-storage.server", () => ({ getCoverStorageConfig: mocks.storage }))
vi.mock("./media-cleanup.server", () => ({ runScheduledMediaCleanup: mocks.cleanup }))

import { handlePreviewMediaCleanup, PREVIEW_CLEANUP_PATH } from "./preview-maintenance.server"
import { runWithRequest, type RuntimeEnv } from "./runtime.server"

const origin = "https://develop.previews.indrax.uk"
const token = "staging-only-maintenance-token-0123456789"
const defaults = () => ({
  SITE_URL: origin,
  DATABASE_URL: "postgres://fixture.invalid/test",
  PREVIEW_MAINTENANCE_ENABLED: "true",
  PREVIEW_MAINTENANCE_TOKEN: token,
})
function request(options: RequestInit = {}, requestOrigin = origin) {
  return new Request(`${requestOrigin}${PREVIEW_CLEANUP_PATH}`, {
    method: "POST",
    body: "{}",
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...options.headers,
    },
  })
}
function invoke(req = request(), env: RuntimeEnv = defaults()) {
  return runWithRequest(req, env, undefined, () => handlePreviewMediaCleanup(req))
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.builtOrigin = origin
  mocks.getDb.mockReturnValue({})
  mocks.storage.mockReturnValue({ bucket: {}, publicUrl: "https://dev-media.indrax.uk" })
  mocks.cleanup.mockResolvedValue(undefined)
})

it("awaits shared cleanup and returns uncached noindex JSON without granting CORS", async () => {
  let release!: () => void
  mocks.cleanup.mockReturnValue(new Promise<void>((resolve) => (release = resolve)))
  let finished = false
  const job = invoke().then((response) => {
    finished = true
    return response
  })
  await vi.waitFor(() => expect(mocks.cleanup).toHaveBeenCalledOnce())
  expect(finished).toBe(false)
  release()
  const response = await job
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ ok: true })
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow")
  expect(response.headers.has("access-control-allow-origin")).toBe(false)
})

it.each([
  { PREVIEW_MAINTENANCE_ENABLED: undefined },
  { PREVIEW_MAINTENANCE_ENABLED: "false" },
  { PREVIEW_MAINTENANCE_TOKEN: undefined },
  { PREVIEW_MAINTENANCE_TOKEN: "short" },
  { PREVIEW_MAINTENANCE_TOKEN: "x".repeat(513) },
  { SITE_URL: "https://indrax.uk" },
  { SITE_URL: "https://another-preview.invalid" },
])(
  "hides maintenance with invalid runtime configuration %o before any data access",
  async (env) => {
    const response = await invoke(request(), { ...defaults(), ...env })
    expect(response.status).toBe(404)
    expect(mocks.getDb).not.toHaveBeenCalled()
    expect(mocks.cleanup).not.toHaveBeenCalled()
  }
)

it("denies a production build even with a spoofed staging host, flag and valid token", async () => {
  mocks.builtOrigin = "https://indrax.uk"
  const response = await invoke(request())
  expect(response.status).toBe(404)
  expect(mocks.getDb).not.toHaveBeenCalled()
  expect(mocks.cleanup).not.toHaveBeenCalled()
})

it.each(["http://develop.previews.indrax.uk", "https://develop.previews.indrax.uk/path"])(
  "rejects unsafe compiled origin %s",
  async (url) => {
    mocks.builtOrigin = url
    expect((await invoke(request(), { ...defaults(), SITE_URL: url })).status).toBe(404)
    expect(mocks.cleanup).not.toHaveBeenCalled()
  }
)

it("does not permit another request host or unique deployment URL to invoke maintenance", async () => {
  expect((await invoke(request({}, "https://other.previews.indrax.uk"))).status).toBe(404)
  expect(mocks.cleanup).not.toHaveBeenCalled()
})

it.each(["GET", "PUT", "OPTIONS"])("rejects %s without data access", async (method) => {
  const response = await invoke(request({ method, body: method === "GET" ? undefined : "{}" }))
  expect(response.status).toBe(405)
  expect(response.headers.get("allow")).toBe("POST")
  expect(mocks.getDb).not.toHaveBeenCalled()
})

it.each(["", "Basic invalid", "Bearer incorrect", "Bearer " + "x".repeat(513)])(
  "rejects missing or incorrect credentials without accepting an author cookie",
  async (authorization) => {
    const response = await invoke(
      request({ headers: { authorization, cookie: "better-auth.session_token=forged" } })
    )
    expect(response.status).toBe(401)
    expect(mocks.getDb).not.toHaveBeenCalled()
    expect(mocks.cleanup).not.toHaveBeenCalled()
  }
)

it("allows same-origin requests but rejects a cross-origin bearer request", async () => {
  expect((await invoke(request({ headers: { origin } }))).status).toBe(200)
  mocks.cleanup.mockClear()
  expect((await invoke(request({ headers: { origin: "https://attacker.invalid" } }))).status).toBe(
    403
  )
  expect(mocks.cleanup).not.toHaveBeenCalled()
})

it.each([
  ["not-json", "application/json", 400],
  ["[]", "application/json", 400],
  ["null", "application/json", 400],
  ['{"limit":1000}', "application/json", 400],
  ["{}", "text/plain", 415],
  [" ".repeat(257), "application/json", 413],
])("validates bounded empty JSON (%s, %s)", async (body, type, status) => {
  const response = await invoke(request({ body, headers: { "content-type": type } }))
  expect(response.status).toBe(status)
  expect(mocks.cleanup).not.toHaveBeenCalled()
})

it("refuses an oversized stream without a declared content length", async () => {
  const response = await invoke(
    request({
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(" ".repeat(257)))
          controller.close()
        },
      }),
      // Node's Request requires duplex for a stream body; Workers ignores it.
      ...({ duplex: "half" } as RequestInit),
    })
  )
  expect(response.status).toBe(413)
  expect(mocks.cleanup).not.toHaveBeenCalled()
})

it.each(["database", "storage", "connection"])(
  "reports missing %s instead of the scheduled function's no-op success",
  async (missing) => {
    const env = defaults()
    if (missing === "database") mocks.getDb.mockReturnValue(null)
    if (missing === "storage") mocks.storage.mockReturnValue(null)
    if (missing === "connection") env.DATABASE_URL = ""
    expect((await invoke(request(), env)).status).toBe(503)
    expect(mocks.cleanup).not.toHaveBeenCalled()
  }
)

it("does not expose upstream errors or token values when cleanup fails", async () => {
  const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined)
  mocks.cleanup.mockRejectedValue(new Error(`https://private-db.invalid?token=${token}`))
  try {
    const response = await invoke()
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain(token)
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(token)
  } finally {
    errorLog.mockRestore()
  }
})
