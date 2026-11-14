import { expect, it, vi } from "vitest"

vi.mock("@/features/writing/data/queries.server", () => ({
  getFeedPosts: vi.fn(async () => []),
}))

import { GET } from "./rss.server"

it("revalidates RSS instead of serving a stale publication list from an HTTP cache", async () => {
  const response = await GET()
  expect(response.headers.get("Cache-Control")).toBe("no-cache, must-revalidate")
  expect(response.headers.get("Content-Type")).toContain("application/rss+xml")
  expect(await response.text()).toContain('<rss version="2.0"')
})
