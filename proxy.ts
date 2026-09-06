import { NextResponse, type NextRequest } from "next/server"

/**
 * Keeps a signed-out browser out of `/admin`, and keeps `/admin` out of search.
 *
 * Named `proxy.ts` rather than `middleware.ts` because Next 16 renamed the
 * convention; the file is otherwise the same thing.
 *
 * **This is a redirect, not an authorization boundary.** It only sees requests
 * that go through routing, and a server action is a POST that a caller can make
 * directly. The check that actually decides anything is `requireAuthor()` in
 * `lib/auth-guard.ts`, which every admin page and every mutating action calls for
 * itself (threat T-3). What this buys is that a signed-out person gets a login
 * page instead of a blank screen.
 *
 * The cookie is only tested for presence. Verifying it would mean a database read
 * on every matched request, and the value of doing that here is nil when the page
 * behind it verifies properly anyway.
 */
const SESSION_COOKIE_PATTERN = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/

export function proxy(request: NextRequest) {
  const response = request.cookies.has("better-auth.session_token")
    ? NextResponse.next()
    : SESSION_COOKIE_PATTERN.test(request.headers.get("cookie") ?? "")
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/admin/login", request.url))

  // Belt and braces with robots.txt: a disallow asks a crawler not to fetch, this
  // tells one that did not ask not to index what it found (PRD US-4.2).
  response.headers.set("X-Robots-Tag", "noindex, nofollow")

  return response
}

export const config = {
  // The login page is deliberately outside this: redirecting it to itself is a
  // loop, and it is the one admin route a signed-out visitor is meant to reach.
  matcher: ["/admin", "/admin/((?!login).*)"],
}
