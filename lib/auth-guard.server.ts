import { getRequest } from "@/lib/runtime.server"

import { allowedGithubId, getAuth, SESSION_ABSOLUTE_MS, type Author } from "@/lib/auth.server"
import { logServerError } from "@/lib/observability"

/**
 * The signed-in author, or null.
 *
 * This is the authorization boundary. Client redirects are a browser convenience;
 * every private API and data mutation still checks the author here.
 * The request memo deduplicates the check only within
 * one server request; a subsequent request checks the session again (threat T-3).
 *
 * Four things have to hold, and all four are re-tested on every request:
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
async function readAuthor(requestHeaders: Headers): Promise<Author | null> {
  const auth = getAuth()
  if (!auth) return null

  const allowed = allowedGithubId()
  if (!allowed) return null

  const session = await auth.api.getSession({ headers: requestHeaders })
  if (!session) return null

  const createdAt = new Date(session.session.createdAt).getTime()

  // `!Number.isFinite`, not `&&`. A guard that cannot evaluate its input has to
  // deny: an unparseable `createdAt` previously *skipped* the absolute cap and
  // admitted the session, which is the opposite of what this function promises
  // three paragraphs above.
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > SESSION_ABSOLUTE_MS) {
    try {
      // Revoke rather than merely refuse, so the next request does not have to
      // make the same decision again.
      await auth.api.revokeSession({
        headers: requestHeaders,
        body: { token: session.session.token },
      })
    } catch (error) {
      // Refusing is the job; tidying up is a courtesy. Letting a failed revoke
      // throw would turn a redirect-to-login into a 500.
      logServerError(error, { scope: "auth.revokeOverAgeSession" })
    }

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

const authorRequests = new WeakMap<Request, Promise<Author | null>>()

export function getAuthor(headers?: Headers): Promise<Author | null> {
  if (headers) return readAuthor(headers)
  const request = getRequest()
  let author = authorRequests.get(request)
  if (!author) {
    author = readAuthor(request.headers)
    authorRequests.set(request, author)
  }
  return author
}

/**
 * The signed-in author, or a thrown rejection.
 *
 * The guard every private read and mutation uses. It throws rather than returning
 * null so that an action cannot accidentally continue past a failed check by
 * ignoring a return value - the failure mode of a guard that is easy to misuse.
 */
export async function requireAuthor(headers?: Headers): Promise<Author> {
  const author = await getAuthor(headers)

  if (!author) {
    // Deliberately uninformative. Whether the session was missing, expired or
    // belongs to someone not on the list is not the caller's business.
    throw new Error("Not authorised.")
  }

  return author
}
