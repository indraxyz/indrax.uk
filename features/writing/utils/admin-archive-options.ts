import { POST_STATUSES, type PostStatus } from "@/features/writing/types"
import {
  ARCHIVE_SORTS,
  archiveSearchParams,
  defaultArchiveOptions,
  parseArchiveOptions,
  type ArchiveOptions,
} from "./archive-options"

export interface AdminArchiveOptions extends ArchiveOptions {
  status: "any" | PostStatus
}
export const defaultAdminArchiveOptions: AdminArchiveOptions = {
  ...defaultArchiveOptions,
  tags: [],
  sort: "updated",
  status: "any",
}
export function parseAdminArchiveOptions(params: URLSearchParams): AdminArchiveOptions {
  const criteria = new URLSearchParams(params)
  if (!ARCHIVE_SORTS.includes(criteria.get("sort") as ArchiveOptions["sort"]))
    criteria.set("sort", "updated")
  const status = params.get("status")
  return {
    ...parseArchiveOptions(criteria),
    status: POST_STATUSES.includes(status as PostStatus) ? (status as PostStatus) : "any",
  }
}
export function adminArchiveSearchParams(
  options: AdminArchiveOptions,
  settings: { includePage?: boolean } = {}
): URLSearchParams {
  const params = archiveSearchParams(options, settings)
  // The admin defaults to activity order. Newest must remain explicit during URL round trips.
  if (options.sort === "updated") params.delete("sort")
  else params.set("sort", options.sort)
  if (options.status !== "any") params.set("status", options.status)
  return params
}
export function hasAdminArchiveFilters(options: AdminArchiveOptions): boolean {
  return (
    options.status !== "any" ||
    options.tags.length > 0 ||
    options.date !== "any" ||
    options.duration !== "any" ||
    options.sort !== "updated"
  )
}
