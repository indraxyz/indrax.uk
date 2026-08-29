// Resume dates are calendar dates, not instants: "1994-03-22" parses as UTC
// midnight, so formatting it in a zone behind UTC would render the day before.
// Pinning the zone to UTC keeps the rendered date equal to the authored one
// regardless of where this runs.
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "long" }

/**
 * Format date to a readable string
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const isDateOnly = typeof date === "string" && DATE_ONLY_PATTERN.test(date)
  const dateObj = typeof date === "string" ? new Date(date) : date

  return dateObj.toLocaleDateString("en-US", {
    ...(options ?? DEFAULT_OPTIONS),
    ...(isDateOnly ? { timeZone: "UTC" } : {}),
  })
}
