import "server-only"

import { headers } from "next/headers"

import { allowedGithubId, getAuth, SESSION_ABSOLUTE_MS, type Author } from "@/lib/auth"

/**
 * The signed-in author, or null.
 *
 * This is the authorization boundary. `proxy.ts` redirects an unauthenticated
 * request away from `/admin`, but a redirect is a convenience for a browser, not
 * a control: a server action is a POST to the application, reachable directly,
 * and nothing about routing stands between a caller and one. So every action and
 * every admin page calls through here, and the checks below run each time rather
 * than being trusted from an earlier layer (threat T-3).
 *
 * Four things have to hold, and all four are re-tested on every call:
 *
 * 1. A session exists and Better Auth considers it valid, which covers idle
 *    expiry, revocation and signature.
 * 2. The session has not passed its absolute age. Better Auth slides `expiresAt`
 *    forward on use, so a session kept warm would otherwise never end; `createdAt`
 *    does not move, which is what makes the cap meaningful.
 * 3. The account is still on the allow-list. A hook runs once at sign-up; this
 *    runs always, so tightening the list takes effect immediately rather than at
 *    the next sign-in.
 * 4. The identity is matched on GitHub's immutable numeric id, never a username.
 */
export async function getAuthor(): Promise<Author | null> {
  const auth = getAuth()
  if (!auth) return null

  const allowed = allowedGithubId()
  if (!allowed) return null

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  const createdAt = new Date(session.session.createdAt).getTime()
  if (Number.isFinite(createdAt) && Date.now() - createdAt > SESSION_ABSOLUTE_MS) {
    // Past its absolute life. Revoke rather than merely refuse, so the next
    // request does not have to make the same decision again.
    await auth.api.revokeSession({
      headers: await headers(),
      body: { token: session.session.token },
    })

    return null
  }

  const user = session.user as { id: string; name?: string; email?: string; githubId?: string }
  if (!user.githubId || user.githubId !== allowed) return null

  return {
    id: user.id,
    name: user.name ?? "",
    email: user.email ?? "",
    githubId: user.githubId,
  }
}

/**
 * The signed-in author, or a thrown rejection.
 *
 * The form every mutating server action uses. It throws rather than returning
 * null so that an action cannot accidentally continue past a failed check by
 * ignoring a return value - the failure mode of a guard that is easy to misuse.
 */
export async function requireAuthor(): Promise<Author> {
  const author = await getAuthor()

  if (!author) {
    // Deliberately uninformative. Whether the session was missing, expired or
    // belongs to someone not on the list is not the caller's business.
    throw new Error("Not authorised.")
  }

  return author
}
