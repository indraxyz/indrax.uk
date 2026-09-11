import type { Instrumentation } from "next"

import { logServerError } from "@/lib/observability"

/**
 * Every server error, in one place, with the reference the reader was shown.
 *
 * Next calls this for anything that fails during a render, a route handler, a
 * server action or the proxy - including the errors that never reach a `catch`
 * of ours. Without it those are logged by Next in its own format and nothing
 * ties them to the digest on the error page.
 *
 * This is the second half of PRD US-6.2. The first half is `app/error.tsx`,
 * which shows the reader the digest and nothing else; this is what makes that
 * digest worth quoting.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  logServerError(error, {
    scope: `${context.routeType}:${context.routePath}`,
    method: request.method,
    path: request.path,
    router: context.routerKind,
    renderSource: context.renderSource,
    revalidateReason: context.revalidateReason,
    // Deliberately not the headers. They carry the session cookie, and a log
    // that contains a live credential is a worse problem than the error it was
    // written to explain.
  })
}
