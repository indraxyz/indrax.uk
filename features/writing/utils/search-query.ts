import { WRITING_CONFIG } from "@/features/writing/config"

/** Normalize a shared search URL without allowing unbounded query input. */
export function normaliseQuery(raw: string | undefined): string {
  const trimmed = (raw ?? "").replace(/\s+/g, " ").trim()
  return trimmed.length > WRITING_CONFIG.maxQueryLength ? "" : trimmed
}
