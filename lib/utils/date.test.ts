import { expect, it } from "vitest"

import { formatDate } from "./date"

it("formats instants and calendar dates as before", () => {
  const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }
  expect(formatDate("2026-10-09T12:00:00Z", options)).toBe(
    new Date("2026-10-09T12:00:00Z").toLocaleDateString("en-US", options)
  )
  // Calendar dates stay on the authored day whatever the local zone.
  expect(formatDate("1994-03-22", options)).toBe("Mar 22, 1994")
  expect(formatDate("1994-03-22")).toBe("March 1994")
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
