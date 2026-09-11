import { describe, expect, it } from "vitest"

import { isSeriesOrderClash, SERIES_ORDER_CONSTRAINT } from "./db-errors"

/**
 * Pinned to the shape a real driver error actually has.
 *
 * The fixture below was not invented - it is what the Neon HTTP driver and
 * Drizzle produced when a duplicate part number was provoked against the real
 * database. The first version of this predicate checked `error.code` and
 * `error.message`, both of which looked right and were both wrong: the wrapper's
 * `code` is `undefined` and its message is the failed SQL, which never names the
 * index. Every clash would have reached the author as a 500.
 *
 * So this file exists to make that specific mistake impossible to repeat
 * silently.
 */
const realClash = () =>
  Object.assign(
    new Error('Failed query: update "posts" set "series_id" = $1, "series_order" = $2'),
    {
      // The wrapper carries no code of its own. This is the trap.
      code: undefined,
      cause: Object.assign(
        new Error(`duplicate key value violates unique constraint "${SERIES_ORDER_CONSTRAINT}"`),
        {
          code: "23505",
          constraint: SERIES_ORDER_CONSTRAINT,
          detail: "Key (series_id, series_order)=(…, 1) already exists.",
          table: "posts",
        }
      ),
    }
  )

describe("isSeriesOrderClash", () => {
  it("recognises the error the real driver raises", () => {
    expect(isSeriesOrderClash(realClash())).toBe(true)
  })

  it("does not depend on the wrapper carrying a code", () => {
    // Asserting the trap directly: the top-level code is undefined, and reading
    // it is what made the first version match nothing.
    const error = realClash() as { code?: unknown }
    expect(error.code).toBeUndefined()
    expect(isSeriesOrderClash(error)).toBe(true)
  })

  it("falls back to the constraint named in the cause's message", () => {
    // A driver that reports the code but no structured `constraint`. Postgres
    // always names it in the message, so there is still something to match.
    const error = {
      cause: {
        code: "23505",
        message: `duplicate key value violates unique constraint "${SERIES_ORDER_CONSTRAINT}"`,
      },
    }

    expect(isSeriesOrderClash(error)).toBe(true)
  })

  it("ignores a unique violation on a different constraint", () => {
    // Two posts cannot share a slug either, and that already has its own message
    // beside the slug field. Claiming it as a series clash would put the error on
    // the wrong input.
    const error = {
      cause: {
        code: "23505",
        constraint: "posts_slug_unique",
        message: 'duplicate key value violates unique constraint "posts_slug_unique"',
      },
    }

    expect(isSeriesOrderClash(error)).toBe(false)
  })

  it("ignores every other failure", () => {
    expect(isSeriesOrderClash(new Error("connection terminated"))).toBe(false)
    expect(isSeriesOrderClash({ cause: { code: "23503" } })).toBe(false)
    expect(isSeriesOrderClash({ cause: { code: "22P02" } })).toBe(false)
  })

  it("does not throw on anything it is handed", () => {
    // It runs inside a catch. Throwing here would replace a handled clash with an
    // unhandled error, which is the one outcome worse than not detecting it.
    for (const value of [null, undefined, "", 0, {}, { cause: null }, { cause: "x" }, []]) {
      expect(() => isSeriesOrderClash(value)).not.toThrow()
      expect(isSeriesOrderClash(value)).toBe(false)
    }
  })
})
