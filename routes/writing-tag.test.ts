import { expect, it } from "vitest"
import { RouterContextProvider } from "react-router"
import { loader as tagLoader } from "@/routes/writing-tag"
import { loader as searchLoader } from "@/routes/writing-search"

const args = (path: string, params: Record<string, string> = {}) => ({
  request: new Request(`https://example.test${path}`),
  url: new URL(`https://example.test${path}`),
  pattern: "/writing/tags/:tag",
  params,
  context: new RouterContextProvider(),
})

it("permanently redirects legacy search with combined filters and pagination intact", () => {
  const response = searchLoader(
    args("/writing/search?q=hello+world&tag=react&sort=relevance&date=30d&duration=short&page=2")
  )
  expect(response.status).toBe(308)
  expect(response.headers.get("location")).toBe(
    "/writing?q=hello+world&tag=react&sort=relevance&date=30d&duration=short&page=2"
  )
})

it("permanently redirects an empty legacy search to the archive", () => {
  expect(searchLoader(args("/writing/search")).headers.get("location")).toBe("/writing")
})

it("moves the legacy tag into the archive query without losing other filters", () => {
  const response = tagLoader(
    args(
      "/writing/tags/typescript?q=worker&tag=react&sort=oldest&date=custom&from=2026-01-01&to=2026-10-10&duration=medium&page=2",
      { tag: "typescript" }
    )
  )
  expect(response.status).toBe(308)
  const target = new URL(response.headers.get("location")!, "https://example.test")
  expect(target.pathname).toBe("/writing")
  expect(target.searchParams.getAll("tag")).toEqual(["react", "typescript"])
  expect(target.searchParams.get("q")).toBe("worker")
  expect(target.searchParams.get("page")).toBe("2")
  expect(target.searchParams.get("from")).toBe("2026-01-01")
  expect(target.searchParams.get("to")).toBe("2026-10-10")
  expect(target.searchParams.get("duration")).toBe("medium")
})

it("does not duplicate a tag already present in the query", () => {
  expect(
    tagLoader(args("/writing/tags/typescript?tag=typescript", { tag: "typescript" })).headers.get(
      "location"
    )
  ).toBe("/writing?tag=typescript")
})
