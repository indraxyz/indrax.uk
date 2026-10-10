import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  request: new Request("https://example.test/admin"),
  getSession: vi.fn(),
  revokeSession: vi.fn(),
  allowed: vi.fn(() => "1"),
}))

vi.mock("@/lib/runtime.server", () => ({ getRequest: () => mocks.request }))
vi.mock("@/lib/auth.server", () => ({
  allowedGithubId: mocks.allowed,
  getAuth: () => ({ api: mocks }),
  SESSION_ABSOLUTE_MS: 60_000,
}))
vi.mock("@/lib/observability", () => ({ logServerError: vi.fn() }))

const { getAuthor, requireAuthor } = await import("./auth-guard.server")

function newRequest() {
  mocks.request = new Request("https://example.test/admin")
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

it("deduplicates concurrent page and data authorization in one server request", async () => {
  const [pageAuthor, queryAuthor] = await Promise.all([getAuthor(), requireAuthor()])
  expect(pageAuthor).toEqual(queryAuthor)
  expect(mocks.getSession).toHaveBeenCalledTimes(1)
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

it("does not memoize explicit headers between independent callers", async () => {
  await requireAuthor(new Headers())
  mocks.getSession.mockResolvedValue(null)
  await expect(requireAuthor(new Headers())).rejects.toThrow("Not authorised")
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
