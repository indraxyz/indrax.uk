import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { runWithRequest } from "./runtime.server"
const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  card: vi.fn(),
  generic: vi.fn(),
  log: vi.fn(),
  slugs: vi.fn(),
  series: vi.fn(),
}))
vi.mock("./rss.server", () => ({ GET: vi.fn() }))
vi.mock("@/features/writing/data/queries.server", () => ({
  getPostBySlug: mocks.post,
  getPublishedSlugs: mocks.slugs,
  getSeriesSlugs: mocks.series,
  getTagsInUse: vi.fn(),
}))
vi.mock("@/features/writing/social-card", () => ({ renderPostCard: mocks.card }))
vi.mock("@/features/resume/social-card", () => ({ renderSocialCard: mocks.generic }))
vi.mock("./observability", () => ({ logServerError: mocks.log }))
import { handleResources } from "./resources.server"
const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const entries = new Map<string, Response>()
const match = vi.fn(async (request: Request) => entries.get(request.url)?.clone())
const put = vi.fn(async (request: Request, response: Response) => {
  entries.set(request.url, response.clone())
})
const request = (path: string, method = "GET") =>
  new Request("https://example.test" + path, { method })
async function handle(input: Request) {
  return runWithRequest(input, {}, undefined, () => handleResources(input))
}
beforeEach(() => {
  entries.clear()
  vi.clearAllMocks()
  vi.stubGlobal("caches", { default: { match, put } })
  mocks.post.mockResolvedValue({
    id: "post",
    slug: "article",
    updatedAt: "2026-10-09T10:00:00.000Z",
  })
  mocks.card.mockImplementation(
    async () => new Response(bytes, { headers: { "content-type": "image/png" } })
  )
  mocks.generic.mockImplementation(
    async () => new Response(bytes, { headers: { "content-type": "image/png" } })
  )
})
afterEach(() => vi.unstubAllGlobals())
it("checks current public post revision before image cache and skips duplicate rendering", async () => {
  const first = await handle(request("/writing/article/opengraph-image"))
  expect(new Uint8Array(await first.arrayBuffer())).toEqual(bytes)
  const second = await handle(request("/writing/article/opengraph-image"))
  expect(new Uint8Array(await second.arrayBuffer())).toEqual(bytes)
  expect(mocks.post).toHaveBeenCalledTimes(2)
  expect(mocks.card).toHaveBeenCalledTimes(1)
  mocks.post.mockResolvedValue({
    id: "post",
    slug: "article",
    updatedAt: "2026-10-09T11:00:00.000Z",
  })
  expect((await handle(request("/writing/article/opengraph-image"))).status).toBe(200)
  expect(mocks.card).toHaveBeenCalledTimes(2)
})
it("stops serving a card when its post is unpublished or missing", async () => {
  await handle(request("/writing/article/opengraph-image"))
  mocks.post.mockResolvedValue(null)
  const response = await handle(request("/writing/article/opengraph-image"))
  expect(response.status).toBe(302)
  expect(response.headers.get("location")).toBe("https://example.test/opengraph-image")
  expect(mocks.card).toHaveBeenCalledTimes(1)
})
it("uses isolated keys for each supported generic card path", async () => {
  for (const path of [
    "/opengraph-image",
    "/resume/opengraph-image",
    "/tech-stack/opengraph-image",
    "/writing/opengraph-image",
  ]) {
    expect((await handle(request(path))).status).toBe(200)
    expect((await handle(request(path))).status).toBe(200)
  }
  expect(mocks.generic).toHaveBeenCalledTimes(4)
  expect(mocks.post).not.toHaveBeenCalled()
})
it("rejects arbitrary card paths and unbounded slug keys before rendering or cache lookup", async () => {
  for (const path of [
    "/admin/opengraph-image",
    "/arbitrary/opengraph-image",
    "/writing/draft/preview/opengraph-image",
    `/writing/${"a".repeat(121)}/opengraph-image`,
  ]) {
    expect((await handle(request(path))).status).toBe(404)
  }
  expect(match).not.toHaveBeenCalled()
  expect(mocks.generic).not.toHaveBeenCalled()
  expect(mocks.post).not.toHaveBeenCalled()
})
it("does not cache rendering errors and retries on the next request", async () => {
  mocks.generic.mockRejectedValueOnce(new Error("renderer unavailable"))
  expect((await handle(request("/opengraph-image"))).status).toBe(503)
  expect(put).not.toHaveBeenCalled()
  expect((await handle(request("/opengraph-image"))).status).toBe(200)
  expect(mocks.generic).toHaveBeenCalledTimes(2)
})
it("HEAD reuses cached PNG metadata without sending a body", async () => {
  await handle(request("/opengraph-image"))
  const response = await handle(request("/opengraph-image", "HEAD"))
  expect(response.status).toBe(200)
  expect(await response.text()).toBe("")
  expect(response.headers.get("content-type")).toBe("image/png")
  expect(mocks.generic).toHaveBeenCalledTimes(1)
})

it("lists the archive, articles and series without retired discovery pages in the sitemap", async () => {
  mocks.slugs.mockResolvedValue([{ slug: "article", updatedAt: "2026-10-10T00:00:00.000Z" }])
  mocks.series.mockResolvedValue([{ slug: "guide", updatedAt: "2026-10-10T00:00:00.000Z" }])
  const response = await handle(request("/sitemap.xml"))
  expect(response.status).toBe(200)
  const xml = await response.text()
  expect(xml).toContain("/writing</loc>")
  expect(xml).toContain("/writing/article</loc>")
  expect(xml).toContain("/writing/series/guide</loc>")
  expect(xml).not.toContain("/writing/tags/")
  expect(xml).not.toContain("/writing/search")
  expect(xml).not.toContain("?tag=")
})
