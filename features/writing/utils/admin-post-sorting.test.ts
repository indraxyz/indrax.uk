import { describe, expect, it } from "vitest"

import { archiveSortForTableSorting, tableSortingForArchiveSort } from "./admin-post-sorting"

describe("admin post table sorting", () => {
  it.each([
    ["title-asc", "title", false],
    ["title-desc", "title", true],
    ["newest", "publishedAt", true],
    ["oldest", "publishedAt", false],
    ["updated", "updatedAt", true],
  ] as const)("maps %s to the %s column and back", (sort, id, desc) => {
    expect(tableSortingForArchiveSort(sort)).toEqual([{ id, desc }])
    expect(archiveSortForTableSorting([{ id, desc }])).toBe(sort)
  })

  it("leaves every header unsorted for orderings without a column", () => {
    expect(tableSortingForArchiveSort("views")).toEqual([])
    expect(tableSortingForArchiveSort("relevance")).toEqual([])
  })

  it("refuses orderings the backend does not offer", () => {
    expect(archiveSortForTableSorting([{ id: "updatedAt", desc: false }])).toBeNull()
    expect(archiveSortForTableSorting([{ id: "status", desc: true }])).toBeNull()
    expect(archiveSortForTableSorting([])).toBeNull()
  })
})
