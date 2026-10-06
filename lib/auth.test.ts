import { afterEach, beforeEach, expect, test, vi } from "vitest"

const database = vi.hoisted(() => ({
  user: [],
  session: [],
  account: [],
  verification: [],
  rateLimit: [],
}))

vi.mock("@/lib/db", () => ({ getDb: () => database, schema: {} }))
vi.mock("better-auth/adapters/drizzle", async () => {
  const { memoryAdapter } = await import("better-auth/adapters/memory")
  return { drizzleAdapter: () => memoryAdapter(database) }
})

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv("DATABASE_URL", "test-only")
  vi.stubEnv("BETTER_AUTH_SECRET", "test-only-secret-for-in-memory-auth-00000000")
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000")
  vi.stubEnv("ALLOWED_GITHUB_ID", "1")
  vi.stubEnv("GITHUB_CLIENT_ID", "test-only")
  vi.stubEnv("GITHUB_CLIENT_SECRET", "test-only")
  for (const rows of Object.values(database)) rows.length = 0
})

afterEach(() => vi.unstubAllEnvs())

test.each(["999", undefined, "1"])(
  "GitHub callback enforces the account allowlist (%s)",
  async (githubId) => {
    const { getAuth } = await import("./auth")
    const auth = getAuth()!
    const context = await auth.$context
    const providers = await context.socialProviders
    const github = providers.find((provider) => provider.id === "github")!
    // Exercise the real Better Auth callback and database hook; only GitHub's
    // network response and the database adapter are replaced with isolated fixtures.
    github.validateAuthorizationCode = async () => ({ accessToken: "test-only", scopes: [] })
    github.getUserInfo = async () => ({
      user: {
        githubId,
        name: "Other account",
        email: "other@example.test",
        emailVerified: true,
      },
      data: { id: 999 },
    })
    const start = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:3000" },
        body: JSON.stringify({
          provider: "github",
          callbackURL: "/admin",
          errorCallbackURL: "/admin/login",
        }),
      })
    )
    expect(start.status).toBe(200)
    const { url } = await start.json()
    const state = new URL(url).searchParams.get("state")
    const cookie = start.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ")
    const callback = await auth.handler(
      new Request(`http://localhost:3000/api/auth/callback/github?code=test-only&state=${state}`, {
        headers: { cookie },
      })
    )
    expect(callback.status).toBe(302)
    const location = new URL(callback.headers.get("location")!, "http://localhost:3000")
    if (githubId === "1") {
      expect(location.pathname).toBe("/admin")
      expect(database.user).toHaveLength(1)
      expect(database.account).toHaveLength(1)
      expect(database.session).toHaveLength(1)
      return
    }
    expect(location.pathname).toBe("/admin/login")
    expect(location.searchParams.get("error")).toBe("account_not_permitted")
    expect(database.user).toHaveLength(0)
    expect(database.account).toHaveLength(0)
    expect(database.session).toHaveLength(0)
    expect(callback.headers.getSetCookie().join(";")).not.toContain("session_token=")
  }
)
