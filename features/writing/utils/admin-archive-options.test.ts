import { expect, it } from "vitest"
import {
  adminArchiveSearchParams,
  defaultAdminArchiveOptions,
  hasAdminArchiveFilters,
  parseAdminArchiveOptions,
} from "./admin-archive-options"

it("defaults admin to activity order and all statuses", () => {
  expect(parseAdminArchiveOptions(new URLSearchParams())).toEqual(defaultAdminArchiveOptions)
  expect(adminArchiveSearchParams(defaultAdminArchiveOptions).toString()).toBe("")
  expect(hasAdminArchiveFilters(defaultAdminArchiveOptions)).toBe(false)
})
it.each(["any", "draft", "published", "archived"])(
  "preserves %s status and explicit newest ordering in URLs",
  (status) => {
    const options = parseAdminArchiveOptions(
      new URLSearchParams({ status, sort: "newest", q: "search", tag: "react", page: "2" })
    )
    expect(options.status).toBe(status)
    expect(parseAdminArchiveOptions(adminArchiveSearchParams(options))).toEqual(options)
    expect(adminArchiveSearchParams(options).get("sort")).toBe("newest")
    expect(hasAdminArchiveFilters(options)).toBe(true)
  }
)
it("normalizes unknown status and invalid criteria without altering shared defaults", () => {
  expect(
    parseAdminArchiveOptions(new URLSearchParams("status=deleted&sort=evil&page=Infinity"))
  ).toEqual(defaultAdminArchiveOptions)
  const options = parseAdminArchiveOptions(new URLSearchParams("status=draft&q=search"))
  expect(hasAdminArchiveFilters(options)).toBe(true)
  options.tags.push("other")
  expect(defaultAdminArchiveOptions.tags).toEqual([])
})
