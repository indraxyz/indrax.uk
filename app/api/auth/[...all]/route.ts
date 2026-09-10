import { toNextJsHandler } from "better-auth/next-js"

import { getAuth } from "@/lib/auth"

// Sessions and the OAuth exchange are per-request by definition; nothing here can
// be prerendered or cached.
export const dynamic = "force-dynamic"

/**
 * Better Auth's endpoints - the GitHub redirect, the callback, sign-out.
 *
 * The filename is Better Auth's convention. When the deployment has no admin
 * configured the whole surface answers 404 rather than erroring: a site with no
 * OAuth application has no sign-in to offer, and saying so as "not found" leaks
 * less than saying so as "misconfigured".
 */
async function handle(request: Request) {
  const auth = getAuth()
  if (!auth) return new Response(null, { status: 404 })

  const { GET, POST } = toNextJsHandler(auth)

  return request.method === "GET" ? GET(request) : POST(request)
}

export const GET = handle
export const POST = handle
