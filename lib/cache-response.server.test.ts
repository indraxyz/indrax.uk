import { afterEach, beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  execution: undefined as undefined | { waitUntil: (promise: Promise<unknown>) => void },
  log: vi.fn(),
}))
vi.mock("./runtime.server", () => ({ getExecutionContext: () => mocks.execution }))
vi.mock("./observability", () => ({ logServerError: mocks.log }))
import { cachedResponse, OG_CACHE_PATH } from "./cache-response.server"
const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const key = (revision = "first") =>
  new Request(
    `https://example.test${OG_CACHE_PATH}?card=article&build=deployment&revision=${revision}`
  )
const png = () => new Response(bytes, { headers: { "Content-Type": "image/png" } })
const entries = new Map<string, Response>()
const match = vi.fn(async (request: Request) => entries.get(request.url)?.clone())
const put = vi.fn(async (request: Request, response: Response) => {
  entries.set(request.url, response.clone())
})
beforeEach(() => {
  entries.clear()
  vi.clearAllMocks()
  mocks.execution = undefined
  vi.stubGlobal("caches", { default: { match, put } })
})
afterEach(() => vi.unstubAllGlobals())
it("stores binary PNG and skips rendering on a matching revision", async () => {
  const loader = vi.fn(async () => png())
  const first = await cachedResponse(key(), loader)
  expect(new Uint8Array(await first.arrayBuffer())).toEqual(bytes)
  const second = await cachedResponse(key(), loader)
  expect(new Uint8Array(await second.arrayBuffer())).toEqual(bytes)
  expect(loader).toHaveBeenCalledTimes(1)
  expect(second.headers.get("Cache-Control")).toBe("public, max-age=0, s-maxage=3600")
})
it("does not serve the previous saved revision or deployment", async () => {
  const loader = vi.fn(async () => png())
  await cachedResponse(key(), loader)
  await cachedResponse(key("edited"), loader)
  const deployed = new URL(key("edited").url)
  deployed.searchParams.set("build", "new-deployment")
  await cachedResponse(new Request(deployed), loader)
  expect(loader).toHaveBeenCalledTimes(3)
})
it("uses a private internal namespace with no visitor headers", async () => {
  const input = key()
  input.headers.set("cookie", "session=secret")
  input.headers.set("authorization", "Bearer private")
  await cachedResponse(input, async () => png())
  const storedKey = put.mock.calls[0][0]
  expect(new URL(storedKey.url).pathname).toBe(OG_CACHE_PATH)
  expect([...storedKey.headers]).toEqual([])
})
it.each([404, 503])("does not cache failed generation (%s)", async (status) => {
  expect(
    (await cachedResponse(key(), async () => new Response("unavailable", { status }))).status
  ).toBe(status)
  expect(put).not.toHaveBeenCalled()
})
const privateHeaders: Record<string, string>[] = [
  { "Content-Type": "application/json" },
  { "Content-Type": "image/png", "Set-Cookie": "private=secret" },
  { "Content-Type": "image/png", "Cache-Control": "private" },
  { "Content-Type": "image/png", "Cache-Control": "no-store" },
]
it.each(privateHeaders)("refuses non-PNG or private response caching (%s)", async (headers) => {
  await cachedResponse(key(), async () => new Response(bytes, { headers }))
  expect(put).not.toHaveBeenCalled()
})
it("bypasses caching for non-GET or non-card namespaces", async () => {
  const loader = vi.fn(async () => png())
  await cachedResponse(new Request("https://example.test/api/admin/posts"), loader)
  await cachedResponse(new Request(key().url, { method: "POST" }), loader)
  expect(match).not.toHaveBeenCalled()
  expect(put).not.toHaveBeenCalled()
  expect(loader).toHaveBeenCalledTimes(2)
})
it("falls back when Cache API is unavailable", async () => {
  vi.stubGlobal("caches", undefined)
  const response = await cachedResponse(key(), async () => png())
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
})
it("logs a failed lookup and returns freshly generated PNG", async () => {
  match.mockRejectedValueOnce(new Error("cache unavailable"))
  const response = await cachedResponse(key(), async () => png())
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
  expect(mocks.log).toHaveBeenCalledWith(expect.any(Error), { scope: "cache.image.read" })
  expect(put).not.toHaveBeenCalled()
})
it("logs write failures without failing the response", async () => {
  put.mockRejectedValueOnce(new Error("write unavailable"))
  const response = await cachedResponse(key(), async () => png())
  expect(response.status).toBe(200)
  expect(mocks.log).toHaveBeenCalledWith(expect.any(Error), { scope: "cache.image.write" })
})
it("schedules independent cache writes through waitUntil", async () => {
  const pending: Promise<unknown>[] = []
  mocks.execution = {
    waitUntil: (promise) => {
      pending.push(promise)
    },
  }
  const response = await cachedResponse(key(), async () => png())
  expect(response.status).toBe(200)
  expect(pending).toHaveLength(1)
  await Promise.all(pending)
  expect(put).toHaveBeenCalledOnce()
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
})
