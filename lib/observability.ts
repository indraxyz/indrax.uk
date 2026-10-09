/** Structured Worker logs retain server diagnostics without exposing them in HTTP responses. */

export interface ErrorContext {
  /** Where in the application this happened, e.g. `writing.getFeedPosts`. */
  scope: string
  /** Anything that narrows it down. Never anything secret. */
  [key: string]: unknown
}

/** Preserve a diagnostic reference when an upstream error supplies one. */
const digestOf = (error: unknown) => {
  const digest = (error as { digest?: unknown } | null)?.digest

  return typeof digest === "string" ? digest : undefined
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error"

/** A cancelled browser navigation is informational rather than a server failure. */
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
    // Optional diagnostic reference from an upstream error.
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
