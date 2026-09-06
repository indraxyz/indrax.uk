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
 *    `next dev` it is the unprefixed name.
 */
export const SESSION_COOKIE_SECURE = "__Secure-better-auth.session_token"
export const SESSION_COOKIE_PLAIN = "better-auth.session_token"

function client(databaseUrl: string) {
  // The local stack speaks Neon's protocol over plain HTTP; see lib/db/index.ts.
  const { hostname, port } = new URL(databaseUrl)
  if (["localhost", "127.0.0.1"].includes(hostname)) {
    neonConfig.fetchEndpoint = `http://${hostname}:${port || "4444"}/sql`
    neonConfig.useSecureWebSocket = false
    neonConfig.poolQueryViaFetch = true
  }

  return drizzle(neon(databaseUrl), { schema })
}

export interface MintedSession {
  cookieValue: string
  userId: string
}

/**
 * Creates the allow-listed author and a session for them, and returns the cookie
 * value a browser would carry.
 */
export async function mintAuthorSession(): Promise<MintedSession> {
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
      githubId,
    },
    // The provisioning source the real GitHub callback would pass.
    { method: "oauth", oauth: { providerId: "github", profile: {} } }
  )

  const session = await internal.createSession(user.id, false)
  const signature = await makeSignature(session.token, secret)

  return { cookieValue: `${session.token}.${signature}`, userId: user.id }
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
