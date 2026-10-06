import { execFileSync } from "node:child_process"

/** Resolve revision metadata at build time; Git is never needed in the Worker/browser. */
export function resolveSiteUpdatedAt(override = process.env.NEXT_PUBLIC_SITE_UPDATED_AT): string {
  let date = override?.trim()
  if (!date) {
    try {
      date = execFileSync("git", ["log", "-1", "--format=%cs"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim()
    } catch {
      throw new Error(
        "Cannot read the revision date. Set NEXT_PUBLIC_SITE_UPDATED_AT (YYYY-MM-DD) when building without Git."
      )
    }
  }

  const parsed = new Date(`${date}T00:00:00Z`)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new Error("NEXT_PUBLIC_SITE_UPDATED_AT must be a valid calendar date (YYYY-MM-DD).")
  }
  return date
}
