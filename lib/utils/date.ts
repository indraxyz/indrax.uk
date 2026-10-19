// Resume dates are calendar dates, not instants: "1994-03-22" parses as UTC
// midnight, so formatting it in a zone behind UTC would render the day before.
// Pinning the zone to UTC keeps the rendered date equal to the authored one
// regardless of where this runs.
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = { year: "numeric", month: "long" }

// Building an Intl.DateTimeFormat is far slower than using one, and
// `toLocaleDateString` builds a fresh one per call. Lists format two dates per
// row, so formatters are created once per distinct option set and reused. The
// set of option shapes is small and fixed by the callers, so the cache stays tiny.
const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options)
  let cached = formatters.get(key)
  if (!cached) {
    cached = new Intl.DateTimeFormat("en-US", options)
    formatters.set(key, cached)
  }
  return cached
}

/**
 * Format date to a readable string
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const isDateOnly = typeof date === "string" && DATE_ONLY_PATTERN.test(date)
  const dateObj = typeof date === "string" ? new Date(date) : date

  return formatter({
    ...(options ?? DEFAULT_OPTIONS),
    ...(isDateOnly ? { timeZone: "UTC" } : {}),
  }).format(dateObj)
}
