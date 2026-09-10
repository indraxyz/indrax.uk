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
 * Record a server-side failure.
 *
 * The stack goes here and only here. It is the difference between an operator
 * being able to fix something and a stranger being handed a map of the codebase.
 */
export function logServerError(error: unknown, context: ErrorContext): void {
  const record = {
    level: "error",
    at: new Date().toISOString(),
    // The reader was shown this. It is how a support message becomes a log query.
    reference: digestOf(error),
    message: messageOf(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  }

  // `console.error` rather than a logging library: on Workers this is what
  // `wrangler tail` and the dashboard read, and a library would be a dependency
  // that buys nothing on a runtime with exactly one sink.
  console.error(JSON.stringify(record))
}
