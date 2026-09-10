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
  if (!db) return null

  return betterAuth({
    database: drizzleAdapter(db, { provider: "pg", schema }),
    baseURL: process.env.BETTER_AUTH_URL ?? SITE_URL,
    secret: requiredEnv("BETTER_AUTH_SECRET"),

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

export const isAuthConfigured = () =>
  Boolean(
    process.env.DATABASE_URL &&
    process.env.BETTER_AUTH_SECRET &&
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET &&
    process.env.ALLOWED_GITHUB_ID
  )

export interface Author {
  id: string
  name: string
  email: string
  githubId: string
}

export const SESSION_ABSOLUTE_MS = SESSION_ABSOLUTE_DAYS * DAY_IN_SECONDS * 1000
export { allowedGithubId }
