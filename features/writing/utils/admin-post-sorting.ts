import type { SortingState } from "@tanstack/react-table"

import type { ArchiveOptions } from "./archive-options"

type ArchiveSort = ArchiveOptions["sort"]

/** Table columns whose header can select a server ordering. */
export type PostTableSortColumn = "title" | "publishedAt" | "updatedAt"

/**
 * The table never reorders a page in the browser: rows come back one page at a
 * time, so a client sort would only shuffle that page. Each header instead maps to
 * one of the archive orderings the backend already validates and applies.
 */
const COLUMN_SORTS: Record<PostTableSortColumn, { asc?: ArchiveSort; desc?: ArchiveSort }> = {
  title: { asc: "title-asc", desc: "title-desc" },
  publishedAt: { asc: "oldest", desc: "newest" },
  // Activity order is newest-first only; the archive has no "least recently updated".
  updatedAt: { desc: "updated" },
}

/** URL ordering to table state; orderings without a visible column sort no header. */
export function tableSortingForArchiveSort(sort: ArchiveSort): SortingState {
  for (const [id, directions] of Object.entries(COLUMN_SORTS)) {
    if (directions.asc === sort) return [{ id, desc: false }]
    if (directions.desc === sort) return [{ id, desc: true }]
  }
  return []
}

/** Table state to URL ordering, or null when the backend has no such ordering. */
export function archiveSortForTableSorting(sorting: SortingState): ArchiveSort | null {
  const [first] = sorting
  if (!first || !(first.id in COLUMN_SORTS)) return null
  const directions = COLUMN_SORTS[first.id as PostTableSortColumn]
  return (first.desc ? directions.desc : directions.asc) ?? null
}
