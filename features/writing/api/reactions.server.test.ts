import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), author: vi.fn(), log: vi.fn() }))
vi.mock("@/features/writing/data/reactions.server", () => ({
  getReactions: mocks.get,
  setReaction: mocks.set,
}))
vi.mock("@/lib/auth-guard.server", () => ({ getAuthor: mocks.author }))
vi.mock("@/lib/observability", () => ({ logServerError: mocks.log }))

import { RequestError } from "@/lib/request-body.server"
import { handleWritingApi } from "./server"

const origin = "https://example.test"
const path = "/api/writing/posts/article/reactions"
const visitorId = "550e8400-e29b-41d4-a716-446655440000"
const input = { visitorId, reaction: "love", active: true }
const value = { counts: { love: 1, noted: 0, thumbsup: 0, fire: 0, rocket: 0 }, selected: ["love"] }
function request(
  method = "GET",
  body: unknown = input,
  headers: Record<string, string> = {},
  endpoint = path
) {
  return new Request(origin + endpoint, {
    method,
    headers: { origin, "content-type": "application/json", ...headers },
    ...(method !== "GET" ? { body: JSON.stringify(body) } : {}),
  })
}
async function status(request: Request) {
  const response = await handleWritingApi(request)
  expect(response?.headers.get("cache-control")).toBe("no-store")
  return response!.status
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.get.mockResolvedValue(value)
  mocks.set.mockResolvedValue(value)
})

it("gets public aggregates without initializing an author session or creating identity", async () => {
  const response = await handleWritingApi(request())
  expect(await response!.json()).toEqual(value)
  expect(mocks.get).toHaveBeenCalledWith("article", undefined)
  expect(response!.headers.has("set-cookie")).toBe(false)
  expect(mocks.author).not.toHaveBeenCalled()
})

it("reads existing visitor selections from a header and accepts desired state", async () => {
  expect(await status(request("GET", undefined, { "x-reaction-visitor": visitorId }))).toBe(200)
  expect(mocks.get).toHaveBeenCalledWith("article", visitorId)
  expect(await status(request("PUT"))).toBe(200)
  expect(mocks.set).toHaveBeenCalledWith("article", input)
  expect(mocks.author).not.toHaveBeenCalled()
})

it.each([
  [request("PUT", input, { origin: "https://other.test" }), 403],
  [request("PUT", input, { "content-type": "text/plain" }), 415],
  [request("PUT", { ...input, active: "true" }), 422],
  [request("PUT", { ...input, visitorId: "bad" }), 422],
  [request("PUT", { ...input, reaction: "other" }), 422],
  [request("PUT", { ...input, extra: "x".repeat(1100) }), 413],
  [request("GET", undefined, { "x-reaction-visitor": "bad" }), 400],
  [request("POST"), 405],
  [request("GET", undefined, {}, "/api/writing/posts/Bad/reactions"), 404],
  [request("GET", undefined, {}, `/api/writing/posts/${"a".repeat(121)}/reactions`), 404],
])("rejects invalid request before database access (#%#)", async (request, expected) => {
  expect(await status(request)).toBe(expected)
  expect(mocks.get).not.toHaveBeenCalled()
  expect(mocks.set).not.toHaveBeenCalled()
})

it("preserves unavailable/not-found errors without exposing database failures", async () => {
  mocks.get.mockRejectedValueOnce(new RequestError(404, "Post not found."))
  expect(await status(request())).toBe(404)
  mocks.get.mockRejectedValueOnce(new RequestError(503, "Reactions are temporarily unavailable."))
  expect(await status(request())).toBe(503)
  mocks.get.mockRejectedValueOnce(new Error("private database connection"))
  const response = await handleWritingApi(request())
  expect(response!.status).toBe(500)
  expect(await response!.text()).not.toContain("private database")
})
