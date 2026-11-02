import { afterEach, expect, it, vi } from "vitest"

import { formatDate } from "./date"

afterEach(() => vi.unstubAllEnvs())

it("formats instants in UTC and preserves authored calendar dates", () => {
  const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }
  expect(formatDate("2026-10-09T12:00:00Z", options)).toBe(
    new Date("2026-10-09T12:00:00Z").toLocaleDateString("en-US", { ...options, timeZone: "UTC" })
  )
  // Calendar dates stay on the authored day whatever the local zone.
  expect(formatDate("1994-03-22", options)).toBe("Mar 22, 1994")
  expect(formatDate("1994-03-22")).toBe("March 1994")
})

it.each(["UTC", "Asia/Makassar", "America/Los_Angeles"])(
  "keeps near-midnight timestamps identical when the runtime uses %s",
  (timeZone) => {
    vi.stubEnv("TZ", timeZone)
    expect(
      formatDate("2026-11-02T23:04:40Z", { year: "numeric", month: "short", day: "numeric" })
    ).toBe("Nov 2, 2026")
  }
)

it("honors an explicit zone for timestamps while keeping calendar dates unchanged", () => {
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Makassar",
  }
  expect(formatDate("2026-11-02T23:04:40Z", options)).toBe("Nov 3, 2026")
  expect(formatDate("2026-11-02", options)).toBe("Nov 2, 2026")
})

it("reuses one formatter per option set across calls", () => {
  const options: Intl.DateTimeFormatOptions = { year: "2-digit", month: "narrow" }
  const Real = Intl.DateTimeFormat
  let created = 0
  // A spy wrapper loses the prototype's `format`, so count with a subclass instead.
  Intl.DateTimeFormat = class extends Real {
    constructor(...args: ConstructorParameters<typeof Real>) {
      super(...args)
      created++
    }
  } as typeof Real
  try {
    for (let day = 1; day <= 20; day++)
      formatDate(`2026-10-${String(day).padStart(2, "0")}`, options)
    // Equal options from separate objects share the cached formatter too.
    formatDate("2026-11-01", { ...options })
  } finally {
    Intl.DateTimeFormat = Real
  }
  expect(created).toBe(1)
})
