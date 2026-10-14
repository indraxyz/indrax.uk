import { describe, expect, it } from "vitest"
import {
  archiveSearchParams,
  defaultArchiveOptions,
  hasArchiveFilters,
  isArchiveDate,
  parseArchiveOptions,
} from "./archive-options"

const parse = (query: string) => parseArchiveOptions(new URLSearchParams(query))
describe("archive URL contract", () => {
  it("round trips all active filters without leaking unrelated parameters", () => {
    const options = parse(
      "q=database%20%20queries&tag=react&tag=postgres&sort=relevance&date=custom&from=2026-01-01&to=2026-02-01&duration=medium&page=2&admin=true"
    )
    expect(options.q).toBe("database queries")
    expect(parse(archiveSearchParams(options).toString())).toEqual(options)
    expect(archiveSearchParams(options).has("admin")).toBe(false)
    expect(archiveSearchParams(options, { includePage: false }).has("page")).toBe(false)
  })
  it("omits defaults and never mutates the shared defaults", () => {
    expect(archiveSearchParams(defaultArchiveOptions).toString()).toBe("")
    parse("").tags.push("test")
    expect(defaultArchiveOptions.tags).toEqual([])
  })
  it("deduplicates and sorts bounded valid tags", () => {
    expect(parse("tag=react&tag=bad%20tag&tag=react&tag=postgres").tags).toEqual([
      "postgres",
      "react",
    ])
    expect(parse(Array.from({ length: 15 }, (_, i) => `tag=tag-${i}`).join("&")).tags).toHaveLength(
      10
    )
  })
  it.each(["NaN", "-1", "1.2", "Infinity", "0"])("normalizes invalid page %s", (page) => {
    expect(parse(`page=${page}`).page).toBe(1)
  })
  it("bounds search depth separately from default archive depth", () => {
    expect(parse("page=999999").page).toBe(1000)
    expect(parse("q=search&page=999999").page).toBe(20)
    expect(parse("sort=relevance").sort).toBe("newest")
    expect(parse("q=" + "x".repeat(121)).q).toBe("")
  })
  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "26-01-01", "0000-01-01"])(
    "rejects invalid calendar date %s",
    (date) => {
      expect(isArchiveDate(date)).toBe(false)
      expect(parse(`date=custom&from=${date}`).date).toBe("any")
    }
  )
  it("supports one-sided ranges, leap days, and rejects reversed ranges", () => {
    expect(isArchiveDate("2024-02-29")).toBe(true)
    expect(parse("date=custom&to=2026-10-10")).toMatchObject({ date: "custom", to: "2026-10-10" })
    expect(parse("date=custom&from=2026-12-01&to=2026-01-01")).toMatchObject({
      date: "any",
      from: "",
      to: "",
    })
    expect(parse("from=2026-01-01").from).toBe("")
  })
  it("reports sheet filters including sort, excluding the visible search box", () => {
    expect(hasArchiveFilters(parse("q=search"))).toBe(false)
    for (const query of ["tag=react", "sort=oldest", "date=7d", "duration=long"])
      expect(hasArchiveFilters(parse(query))).toBe(true)
  })
})
