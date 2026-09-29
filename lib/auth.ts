import "server-only"

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { APIError } from "better-auth/api"

import { SITE_URL } from "@/features/resume/config"
import { getDb, schema } from "@/lib/db"

/**
 * Sessions live in the database, not in a stateless token.
 *
 * The whole point is revocability: losing a laptop should be one `delete` away
 * from being harmless, which a signed JWT cannot offer at any expiry.
 *
 * Two bounds, because they answer different questions. Idle expiry ends a session
 * that has stopped being used; it slides forward on activity, so writing every day
 * never signs you out. Absolute expiry ends it regardless, so a session that has
 * been quietly kept warm cannot live forever. Better Auth enforces the first
 * natively; the second is enforced in `requireAuthor` against the session's
 * creation time, since a refresh moves `expiresAt` but never `createdAt`.
 */
const SESSION_IDLE_DAYS = 7
const SESSION_ABSOLUTE_DAYS = 30
const DAY_IN_SECONDS = 60 * 60 * 24

/**
 * The one GitHub account allowed to sign in, as an immutable numeric id.
 *
 * Not a username. GitHub usernames can be changed by their owner and reclaimed by
 * someone else once released, so a username allow-list is a name-squatting
 * problem waiting to happen. The numeric id is stable for the life of the account
 * (threat T-1).
 */
const allowedGithubId = () => process.env.ALLOWED_GITHUB_ID?.trim()

/**
 * Whether this deployment has an admin at all.
 *
 * Trimmed, because a variable set to whitespace is a variable that is not set -
 * and the difference between "no admin" and "an admin nobody can sign in to" is
 * one a half-finished `.env` file will produce.
 */
export const isAuthConfigured = () =>
  Boolean(
    process.env.DATABASE_URL?.trim() &&
    process.env.BETTER_AUTH_SECRET?.trim() &&
    process.env.GITHUB_CLIENT_ID?.trim() &&
    process.env.GITHUB_CLIENT_SECRET?.trim() &&
    allowedGithubId()
  )

function requiredEnv(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(
      `${name} is not set. The admin cannot be configured without it - see README.md.`
    )
  }

  return value
}

/**
 * The auth instance, or null when this deployment has no admin.
 *
 * The same shape as `getDb`, and for the same reason: a fresh clone, a CI build
 * and a preview branch have no OAuth application and no database, and none of them
 * should fail to build over it. What changes without configuration is that
 * `/admin` is unreachable rather than merely locked - which is the safe direction.
 */
let instance: ReturnType<typeof create> | null | undefined

function create() {
  const db = getDb()

  // Every check up front, so `requiredEnv` below is unreachable by construction.
  // Without this a deployment with a database but no OAuth application threw from
  // inside the object literal on every call - which meant `/admin` and the whole
  // auth surface answered 500 rather than behaving as if there were no admin,
  // exactly contradicting the comment above.
  if (!db || !isAuthConfigured()) return null

  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema }),
    baseURL: process.env.BETTER_AUTH_URL ?? SITE_URL,
    secret: requiredEnv("BETTER_AUTH_SECRET"),

    account: {
      /**
       * No implicit account linking. This is the single most important line in
       * the file.
       *
       * Better Auth's default is to link an incoming OAuth account to an existing
       * user row **matched by verified email**. That path calls `linkAccount` and
       * `createSession` directly - it never calls `createUser`, so the allow-list
       * hook below never runs. And `requireAuthor` then reads `githubId` off the
       * *stored row*, which is the author's, not the identity that just
       * authenticated.
       *
       * So: anyone who could get GitHub to verify the author's email address on
       * an account of their own would sign in as the author, past a hook that
       * never fired and a check that was looking at the wrong record. The
       * "immutable numeric id" property T-1 claims only holds if every path to a
       * session goes through the hook, and this is the one that did not.
       */
      accountLinking: { enabled: false },
    },

    // GitHub only. There is no password to hash, rotate, reset or leak, and the
    // account it federates to is one the author already protects with 2FA.
    socialProviders: {
      github: {
        clientId: requiredEnv("GITHUB_CLIENT_ID"),
        clientSecret: requiredEnv("GITHUB_CLIENT_SECRET"),
        mapProfileToUser: (profile) => ({ githubId: String(profile.id) }),
      },
    },

    user: {
      additionalFields: {
        // Stored as text rather than a number: it is an identifier, never
        // arithmetic, and comparing strings avoids any question of precision.
        githubId: { type: "string", input: true, returned: true },
      },
    },

    session: {
      expiresIn: SESSION_IDLE_DAYS * DAY_IN_SECONDS,
      // Refresh the window when a session is used inside its last day, so an
      // active author is never signed out mid-edit.
      updateAge: DAY_IN_SECONDS,
    },

    rateLimit: {
      /**
       * Counted in the database, not in memory.
       *
       * Better Auth's default store is per-process, and on Workers "per process"
       * means per isolate - so the counter resets constantly and the limit reads
       * far stronger than it is. The database is the only shared thing here
       * (threat T-11).
       */
      storage: "database",
    },

    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
      defaultCookieAttributes: {
        httpOnly: true,
        // `strict`, not `lax`. Nothing links into the admin from outside, so
        // there is no navigation this breaks - and it is a second lock on CSRF
        // behind the server actions' own (threat T-9).
        sameSite: "strict",
      },
    },

    databaseHooks: {
      user: {
        create: {
          /**
           * The allow-list, enforced before a row exists.
           *
           * A rejected sign-in must leave nothing behind: no user, and therefore
           * no session and no account (PRD US-4.1). Throwing here is what makes
           * that true - returning false would abort the write but is a weaker
           * signal to the caller.
           *
           * This is not the only check. `requireAuthor` re-tests the same id on
           * every use, because a hook only runs at creation and an allow-list that
           * is only consulted once is an allow-list that cannot be tightened.
           */
          before: async (user) => {
            const allowed = allowedGithubId()
            const githubId = (user as { githubId?: string }).githubId

            if (!allowed || !githubId || githubId !== allowed) {
              throw new APIError("FORBIDDEN", {
                message: "This GitHub account is not permitted to sign in.",
              })
            }

            return { data: user }
          },
        },
      },
    },
  })
}

export function getAuth() {
  if (instance !== undefined) return instance

  instance = create()

  return instance
}

export interface Author {
  id: string
  name: string
  email: string
  githubId: string
}

export const SESSION_ABSOLUTE_MS = SESSION_ABSOLUTE_DAYS * DAY_IN_SECONDS * 1000
export { allowedGithubId }
