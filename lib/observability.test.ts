import { afterEach, describe, expect, it, vi } from "vitest"

import { logServerError, type ErrorContext } from "./observability"

/**
 * A logger is only worth having if the line it writes can be searched, and only
 * worth alerting on if the level means something. Both are asserted here.
 *
 * What is *not* logged - the request headers, which carry the session cookie - is
 * decided by the caller in `instrumentation.ts` rather than here, so it is not
 * this file's to prove.
 */
function captured(error: unknown, context: ErrorContext = { scope: "test" }) {
  // Cleared rather than freshly spied: `spyOn` hands back the existing mock when
  // one is already installed, so a second call in the same test would otherwise
  // read the first call's line.
  const errors = vi.spyOn(console, "error").mockImplementation(() => {})
  const infos = vi.spyOn(console, "info").mockImplementation(() => {})

  errors.mockClear()
  infos.mockClear()

  logServerError(error, context)

  const line = (errors.mock.calls[0] ?? infos.mock.calls[0])?.[0] as string

  return {
    record: JSON.parse(line) as Record<string, unknown>,
    stream: errors.mock.calls.length ? "error" : "info",
  }
}

afterEach(() => vi.restoreAllMocks())

describe("logServerError", () => {
  it("writes one line of JSON, not a sentence", () => {
    const { record } = captured(new Error("Boom"))

    expect(record.level).toBe("error")
    expect(record.message).toBe("Boom")
    expect(record.scope).toBe("test")
    expect(typeof record.at).toBe("string")
  })

  it("carries the digest the reader was shown, so a report becomes a query", () => {
    // This is the whole point of the file: Next renders this number on the error
    // page and withholds everything else, so it is the only handle a reader has.
    const error = Object.assign(new Error("Boom"), { digest: "1607737151" })

    expect(captured(error).record.reference).toBe("1607737151")
  })

  it("keeps the stack, which is the difference between fixing and guessing", () => {
    expect(captured(new Error("Boom")).record.stack).toContain("Error: Boom")
  })

  it("survives something that is not an Error at all", () => {
    expect(captured("just a string").record.message).toBe("just a string")
    expect(captured(null).record.message).toBe("Unknown error")
    expect(captured(undefined).record.stack).toBeUndefined()
  })

  it("lets the caller add context, and does not let it be overwritten silently", () => {
    const { record } = captured(new Error("Boom"), { scope: "blog.getFeedPosts", slug: "a-post" })

    expect(record.scope).toBe("blog.getFeedPosts")
    expect(record.slug).toBe("a-post")
  })
})

describe("logServerError — a reader who left is not a failure", () => {
  /**
   * Next prefetches an RSC payload on hover and cancels it when the pointer moves
   * on. Five of these appeared in a single end-to-end run; a real tag list
   * produces them steadily. At `error` they bury the failures the digest exists
   * to make findable.
   */
  const disconnects = [
    new Error("The destination stream closed early."),
    new Error("The user aborted a request."),
    new Error("aborted"),
    Object.assign(new Error("whatever the message is"), { name: "AbortError" }),
  ]

  it.each(disconnects)("records %s at info, on the info stream", (error) => {
    const { record, stream } = captured(error)

    expect(record.level).toBe("info")
    expect(stream).toBe("info")
  })

  it("drops the stack for one, because there is nothing to fix", () => {
    expect(captured(new Error("The destination stream closed early.")).record.stack).toBeUndefined()
  })

  it("still records it rather than swallowing it", () => {
    // Demoted, not hidden. A flood of these is itself a signal.
    const { record } = captured(new Error("aborted"), { scope: "render:/blog/tag/[tag]" })

    expect(record.message).toBe("aborted")
    expect(record.scope).toBe("render:/blog/tag/[tag]")
  })

  it("does not demote a real error that merely mentions aborting", () => {
    // The guard this list needs: matching loosely would silently reclassify
    // genuine failures as noise, which is worse than the noise.
    const { record, stream } = captured(new Error("The upload was aborted by the storage backend"))

    expect(record.level).toBe("error")
    expect(stream).toBe("error")
  })
})
