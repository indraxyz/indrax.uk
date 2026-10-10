import { WRITING_CONFIG } from "@/features/writing/config"
import { normaliseQuery } from "./search-query"

export const ARCHIVE_SORTS = [
  "newest",
  "oldest",
  "views",
  "updated",
  "relevance",
  "title-asc",
  "title-desc",
] as const
export const ARCHIVE_DATES = ["any", "7d", "30d", "year", "custom"] as const
export const ARCHIVE_DURATIONS = ["any", "short", "medium", "long"] as const
export const MAX_ARCHIVE_TAGS = 10

export interface ArchiveOptions {
  q: string
  tags: string[]
  sort: (typeof ARCHIVE_SORTS)[number]
  date: (typeof ARCHIVE_DATES)[number]
  from: string
  to: string
  duration: (typeof ARCHIVE_DURATIONS)[number]
  page: number
}
export const defaultArchiveOptions: ArchiveOptions = {
  q: "",
  tags: [],
  sort: "newest",
  date: "any",
  from: "",
  to: "",
  duration: "any",
  page: 1,
}

/** Reject calendar rollover (February 30), not merely malformed strings. */
export function isArchiveDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= "0001-01-01" &&
    value <= "9999-12-31" &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  )
}
export function isArchiveTag(value: string): boolean {
  return value.length <= 120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}
function option<T extends string>(value: string | null, choices: readonly T[], fallback: T): T {
  return choices.includes(value as T) ? (value as T) : fallback
}

/** The result navigator must expose only pages accepted by the request boundary. */
export function archivePageLimit(query: string): number {
  return query ? WRITING_CONFIG.maxSearchPage : WRITING_CONFIG.maxPage
}

/** One bounded, canonical contract shared by browser URLs and server queries. */
export function parseArchiveOptions(params: URLSearchParams): ArchiveOptions {
  const q = normaliseQuery(params.get("q") ?? undefined)
  const sort = option(params.get("sort"), ARCHIVE_SORTS, "newest")
  let date = option(params.get("date"), ARCHIVE_DATES, "any")
  let from = params.get("from") ?? ""
  let to = params.get("to") ?? ""
  if (
    date !== "custom" ||
    (from && !isArchiveDate(from)) ||
    (to && !isArchiveDate(to)) ||
    (from && to && from > to) ||
    (!from && !to)
  ) {
    if (date === "custom") date = "any"
    from = ""
    to = ""
  }
  const page = Number(params.get("page") ?? 1)
  return {
    q,
    tags: [...new Set(params.getAll("tag").filter(isArchiveTag))].sort().slice(0, MAX_ARCHIVE_TAGS),
    sort: sort === "relevance" && !q ? "newest" : sort,
    date,
    from,
    to,
    duration: option(params.get("duration"), ARCHIVE_DURATIONS, "any"),
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, archivePageLimit(q)) : 1,
  }
}

export function archiveSearchParams(
  options: ArchiveOptions,
  { includePage = true }: { includePage?: boolean } = {}
): URLSearchParams {
  const params = new URLSearchParams()
  if (options.q) params.set("q", options.q)
  for (const tag of options.tags) params.append("tag", tag)
  if (options.sort !== "newest") params.set("sort", options.sort)
  if (options.date !== "any") params.set("date", options.date)
  if (options.date === "custom") {
    if (options.from) params.set("from", options.from)
    if (options.to) params.set("to", options.to)
  }
  if (options.duration !== "any") params.set("duration", options.duration)
  if (includePage && options.page > 1) params.set("page", String(options.page))
  return params
}

/** Search has its own visible input; the dot represents settings inside the sheet. */
export function hasArchiveFilters(options: ArchiveOptions): boolean {
  return (
    options.tags.length > 0 ||
    options.date !== "any" ||
    options.duration !== "any" ||
    options.sort !== "newest"
  )
}
