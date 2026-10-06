import readingTime from "reading-time"

/**
 * Reading time in whole minutes, rounded up so a 30-second note reads "1 min"
 * rather than "0 min".
 *
 * Computed server-side on write and stored on the row. It is never accepted from
 * a client - it is a pure function of the content, so a submitted value could
 * only ever be a lie or a duplicate (PRD US-3.1).
 */
export function computeReadingTime(content: string): number {
  return Math.max(1, Math.ceil(readingTime(content).minutes))
}
