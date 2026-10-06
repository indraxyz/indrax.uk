import { describe, expect, it } from "vitest"

import { computeReadingTime } from "./reading-time"

describe("computeReadingTime", () => {
  it("never reports zero minutes", () => {
    // A thirty-second note reading "0 min" is worse than a rounded-up "1 min".
    expect(computeReadingTime("one word")).toBe(1)
    expect(computeReadingTime("")).toBe(1)
  })

  it("rounds up rather than to nearest", () => {
    // Roughly 250 words: over one minute, so two.
    expect(computeReadingTime("word ".repeat(250))).toBeGreaterThanOrEqual(2)
  })

  it("grows with the length of the text", () => {
    const short = computeReadingTime("word ".repeat(200))
    const long = computeReadingTime("word ".repeat(2000))

    expect(long).toBeGreaterThan(short)
  })

  it("returns a whole number of minutes", () => {
    const minutes = computeReadingTime("word ".repeat(637))
    expect(Number.isInteger(minutes)).toBe(true)
  })
})
