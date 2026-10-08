import { createRequire } from "node:module"
import { dirname, join } from "node:path"

import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  headers: vi.fn(async () => new Headers()),
  getSession: vi.fn(),
  revokeSession: vi.fn(),
  allowed: vi.fn(() => "1"),
}))

vi.mock("next/headers", () => ({ headers: mocks.headers }))
vi.mock("@/lib/auth", () => ({
  allowedGithubId: mocks.allowed,
  getAuth: () => ({ api: mocks }),
  SESSION_ABSOLUTE_MS: 60_000,
}))
vi.mock("@/lib/observability", () => ({ logServerError: vi.fn() }))

// Use the actual React server cache. The default client export is intentionally
// a no-op outside RSC, so supply the request dispatcher normally owned by React.
vi.mock("react", async () => {
  const require = createRequire(import.meta.url)
  return require(join(dirname(require.resolve("react")), "cjs/react.react-server.development.js"))
})
const React = await import("react")
const internals = (
  React as unknown as {
    __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {
      A: null | { getCacheForType: (factory: () => unknown) => unknown }
    }
  }
).__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE
const { getAuthor, requireAuthor } = await import("./auth-guard")

function newRequest() {
  const requestCache = new Map<() => unknown, unknown>()
  internals.A = {
    getCacheForType(factory) {
      if (!requestCache.has(factory)) requestCache.set(factory, factory())
      return requestCache.get(factory)
    },
  }
}

function session(createdAt = new Date(), githubId = "1") {
  return {
    session: { createdAt, token: "test-token" },
    user: { id: "author", name: "Author", email: "author@example.test", githubId },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.allowed.mockReturnValue("1")
  mocks.getSession.mockResolvedValue(session())
  newRequest()
})
afterEach(() => {
  internals.A = null
})

it("deduplicates concurrent page and data authorization in one server request", async () => {
  const [pageAuthor, queryAuthor] = await Promise.all([getAuthor(), requireAuthor()])
  expect(pageAuthor).toEqual(queryAuthor)
  expect(mocks.getSession).toHaveBeenCalledTimes(1)
  expect(mocks.headers).toHaveBeenCalledTimes(1)
})

it("checks a revoked session again in the next request", async () => {
  expect(await requireAuthor()).toMatchObject({ id: "author" })
  mocks.getSession.mockResolvedValue(null)
  newRequest()
  await expect(requireAuthor()).rejects.toThrow("Not authorised")
  expect(mocks.getSession).toHaveBeenCalledTimes(2)
})

it("rechecks an allowlist change in the next request", async () => {
  await requireAuthor()
  mocks.allowed.mockReturnValue("2")
  newRequest()
  expect(await getAuthor()).toBeNull()
  expect(mocks.getSession).toHaveBeenCalledTimes(2)
})

it.each([new Date(Date.now() - 120_000), "invalid-date"])(
  "denies and revokes over-age or malformed sessions (%s)",
  async (createdAt) => {
    mocks.getSession.mockResolvedValue(session(createdAt as Date))
    expect(await getAuthor()).toBeNull()
    await expect(requireAuthor()).rejects.toThrow("Not authorised")
    expect(mocks.revokeSession).toHaveBeenCalledTimes(1)
  }
)

it("rechecks absolute age on subsequent requests", async () => {
  await requireAuthor()
  mocks.getSession.mockResolvedValue(session(new Date(Date.now() - 120_000)))
  newRequest()
  expect(await getAuthor()).toBeNull()
  expect(mocks.revokeSession).toHaveBeenCalledTimes(1)
})

it("still refuses access when revoking an expired session fails", async () => {
  mocks.getSession.mockResolvedValue(session(new Date(Date.now() - 120_000)))
  mocks.revokeSession.mockRejectedValueOnce(new Error("Database unavailable"))
  await expect(requireAuthor()).rejects.toThrow("Not authorised")
})

it("does not cache authorization outside a React server request", async () => {
  internals.A = null
  await requireAuthor()
  mocks.getSession.mockResolvedValue(null)
  await expect(requireAuthor()).rejects.toThrow("Not authorised")
  expect(mocks.getSession).toHaveBeenCalledTimes(2)
})

it("denies requests with no configured allowlist without querying sessions", async () => {
  mocks.allowed.mockReturnValue("")
  expect(await getAuthor()).toBeNull()
  expect(mocks.getSession).not.toHaveBeenCalled()
})

it.each(["another-id", undefined])("denies a non-allowlisted identity (%s)", async (githubId) => {
  mocks.getSession.mockResolvedValue({ ...session(), user: { ...session().user, githubId } })
  await expect(requireAuthor()).rejects.toThrow("Not authorised")
})
