/**
 * One shape for everything this application logs when something goes wrong.
 *
 * The point is not tidiness. PRD US-6.2 asks that a server error be findable
 * from what the reader was shown, and that the reader be shown nothing more than
 * that. Two things have to line up for it:
 *
 * - the **reference** the reader sees on the error page, and
 * - the **log line** an operator greps for
 *
 * Next already supplies the first: it hashes every server error into a `digest`,
 * renders that on `app/error.tsx`, and withholds the message and stack. So the
 * digest is the correlation id and there is no reason to invent a second one -
 * a request id the reader never sees would be a number nobody could quote.
 *
 * Structured rather than interpolated, because a log line is read by a machine
 * before it is read by a person. Cloudflare's tail, and every log platform
 * behind it, will parse one JSON object per line and let the digest be a filter;
 * none of them can do anything useful with a sentence.
 */

export interface ErrorContext {
  /** Where in the application this happened, e.g. `blog.getFeedPosts`. */
  scope: string
  /** Anything that narrows it down. Never anything secret. */
  [key: string]: unknown
}

/** Next hashes each error into this and shows it to the reader. */
const digestOf = (error: unknown) => {
  const digest = (error as { digest?: unknown } | null)?.digest

  return typeof digest === "string" ? digest : undefined
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error"

/**
 * A reader who left, not a failure.
 *
 * Next prefetches the RSC payload for a link on hover, and cancels it the moment
 * the pointer moves on or the visitor navigates. The render is already in flight,
 * so it finishes into a socket nobody is holding and throws. Nothing is wrong:
 * the page was served, or was never wanted.
 *
 * This matters because it is by far the most frequent thing `onRequestError`
 * sees - five in a single test run, and a real visitor hovering a tag list
 * produces them steadily. Logged at `error` they bury the failures the digest is
 * meant to make findable, and any alert built on the level fires constantly. So
 * they are recorded, at `info`, and stay out of the way.
 *
 * Matched on message because Next throws a plain `Error` with no code or name to
 * check. That is a list which may need extending; it is guarded by
 * `observability.test.ts`, which will fail loudly rather than silently
 * reclassifying a genuine error.
 */
const CLIENT_DISCONNECT_MESSAGES = new Set([
  "The destination stream closed early.",
  "The user aborted a request.",
  "aborted",
])

function isClientDisconnect(error: unknown): boolean {
  if (error instanceof Error && error.name === "AbortError") return true

  return CLIENT_DISCONNECT_MESSAGES.has(messageOf(error))
}

/**
 * Record a server-side failure.
 *
 * The stack goes here and only here. It is the difference between an operator
 * being able to fix something and a stranger being handed a map of the codebase.
 */
export function logServerError(error: unknown, context: ErrorContext): void {
  const disconnected = isClientDisconnect(error)

  const record = {
    level: disconnected ? "info" : "error",
    at: new Date().toISOString(),
    // The reader was shown this. It is how a support message becomes a log query.
    reference: digestOf(error),
    message: messageOf(error),
    // No stack for a disconnect. There is nothing to fix at the other end of it,
    // and it is the bulkiest field in the line.
    stack: !disconnected && error instanceof Error ? error.stack : undefined,
    ...context,
  }

  // `console` rather than a logging library: on Workers this is what
  // `wrangler tail` and the dashboard read, and a library would be a dependency
  // that buys nothing on a runtime with exactly one sink. The stream is chosen to
  // match the level, so a disconnect does not reach stderr and trip anything
  // watching it.
  const write = disconnected ? console.info : console.error

  write(JSON.stringify(record))
}
