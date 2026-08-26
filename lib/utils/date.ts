/**
 * Format date to a readable string
 */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === "string" ? new Date(date) : date
  return dateObj.toLocaleDateString("en-US", options || { year: "numeric", month: "long" })
}

/**
 * Get current date formatted
 */
export function getCurrentDateFormatted(): string {
  return formatDate(new Date())
}
