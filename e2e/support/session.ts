import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { makeSignature } from "better-auth/crypto"
import { neon, neonConfig } from "@neondatabase/serverless"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/neon-http"

import * as schema from "@/lib/db/schema"

/**
 * Mints a real signed-in session for the authoring specs.
 *
 * There is no way to drive GitHub's OAuth flow from a test, and no reason to want
 * one - a fake identity provider only proves that a fake behaves like a fake. So
 * this creates the session through Better Auth's own internal adapter, which is
 * the same code path the real callback uses once GitHub has answered. Everything
 * after that point - the cookie, the guard, the allow-list, the actions - is the
 * production path, unmodified.
 *
 * Nothing here is reachable from the application. It is a test helper that talks
 * to the database directly, and the application has no equivalent entry point
 * (which is the whole point of it needing to exist).
 *
 * Two details cost an afternoon to find and are worth stating, because neither is
 * obvious and both fail as a silent `null` session:
 *
 * 1. The cookie is signed. The value is `${token}.${signature}`, not the bare
 *    token that `createSession` hands back.
 * 2. `npm run start` sets `NODE_ENV=production`, which turns on `useSecureCookies`
 *    - and that renames the cookie to `__Secure-better-auth.session_token`. Under
 *    `next dev` it is the unprefixed name, which is why the suite runs against a
 *    production build and only the prefixed name is exported here.
 */
export const SESSION_COOKIE_SECURE = "__Secure-better-auth.session_token"

// Loopback only. This module creates a real allow-listed author and a valid
// signed session, so pointed at production it would provision an admin identity
// there - one exported `DATABASE_URL` away. `lib/db/index.ts` guards its own
// local-endpoint override the same way, and for the same reason.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

function assertLocal(databaseUrl: string) {
  const { hostname } = new URL(databaseUrl)

  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(
      `Refusing to mint a session against ${hostname}. This helper creates a real ` +
        "author and a valid session, and is for a local database only."
    )
  }
}

function client(databaseUrl: string) {
  assertLocal(databaseUrl)

  // The local stack speaks Neon's protocol over plain HTTP; see lib/db/index.ts.
  const { hostname, port } = new URL(databaseUrl)
  if (LOCAL_HOSTS.has(hostname)) {
    neonConfig.fetchEndpoint = `http://${hostname}:${port || "4444"}/sql`
    neonConfig.useSecureWebSocket = false
    neonConfig.poolQueryViaFetch = true
  }

  return drizzle(neon(databaseUrl), { schema })
}

export interface MintedSession {
  cookieValue: string
  userId: string
  token: string
}

export interface MintOptions {
  /**
   * Override the GitHub id the identity carries. Defaults to the allow-listed
   * one; anything else must be refused by `requireAuthor`, which is the point of
   * being able to set it.
   */
  githubId?: string
  /**
   * Backdate the session's creation. Better Auth slides `expiresAt` forward on
   * use, so only `createdAt` can express "this session has existed too long" -
   * which is what the absolute cap is checked against.
   */
  createdAtMsAgo?: number
}

/**
 * Creates an author and a session for them, and returns the cookie value a
 * browser would carry.
 */
export async function mintAuthorSession(options: MintOptions = {}): Promise<MintedSession> {
  const databaseUrl = process.env.DATABASE_URL
  const secret = process.env.BETTER_AUTH_SECRET
  const githubId = process.env.ALLOWED_GITHUB_ID

  if (!databaseUrl || !secret || !githubId) {
    throw new Error(
      "mintAuthorSession needs DATABASE_URL, BETTER_AUTH_SECRET and ALLOWED_GITHUB_ID."
    )
  }

  const db = client(databaseUrl)
  const auth = betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema }),
    secret,
    socialProviders: { github: { clientId: "unused", clientSecret: "unused" } },
    user: { additionalFields: { githubId: { type: "string", input: true, returned: true } } },
  })

  const context = await auth.$context
  const internal = context.internalAdapter

  const user = await internal.createUser(
    {
      name: "Test Author",
      email: `author-${crypto.randomUUID()}@example.invalid`,
      // The allow-list key. A session for any other id must be refused by
      // `requireAuthor`, which is what `admin-boundary.spec.ts` asserts.
      githubId: options.githubId ?? githubId,
    },
    // The provisioning source the real GitHub callback would pass.
    { method: "oauth", oauth: { providerId: "github", profile: {} } }
  )

  const session = await internal.createSession(user.id, false)

  if (options.createdAtMsAgo) {
    // Written directly: the adapter has no way to say "created earlier", and
    // waiting thirty days for the assertion is not an option.
    await db
      .update(schema.session)
      .set({ createdAt: new Date(Date.now() - options.createdAtMsAgo) })
      .where(eq(schema.session.token, session.token))
  }

  const signature = await makeSignature(session.token, secret)

  return {
    cookieValue: `${session.token}.${signature}`,
    userId: user.id,
    token: session.token,
  }
}

/** Whether a session row still exists, for asserting that sign-out revoked it. */
export async function sessionExists(token: string): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return false

  const rows = await client(databaseUrl)
    .select({ token: schema.session.token })
    .from(schema.session)
    .where(eq(schema.session.token, token))
    .limit(1)

  return rows.length > 0
}

/**
 * Removes a minted author and everything hanging off them.
 *
 * The session and account rows cascade from the user, so this is one delete. Left
 * out, every run would leave a signed-in identity behind in the development
 * database - which is untidy at best and misleading at worst.
 */
export async function revokeAuthorSession(userId: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return

  await client(databaseUrl).delete(schema.user).where(eq(schema.user.id, userId))
}
