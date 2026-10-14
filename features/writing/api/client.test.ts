import { afterEach, beforeEach, expect, it, vi, type Mock } from "vitest"
import { HTTPError } from "ky"

import { adminApi, adminKeys, writingApi, writingKeys } from "./client"
import { parseAdminArchiveOptions } from "@/features/writing/utils/admin-archive-options"
import { parseArchiveOptions } from "@/features/writing/utils/archive-options"

const NativeRequest = globalThis.Request
let requests: Request[]
let fetchMock: Mock<(request: Request, ...args: unknown[]) => Promise<Response>>
beforeEach(() => {
  vi.stubGlobal(
    "Request",
    class extends NativeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(
          typeof input === "string" && input.startsWith("/")
            ? `https://example.test${input}`
            : input,
          init
        )
      }
    }
  )
  requests = []
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", (request: Request, ...args: unknown[]) => {
    requests.push(request.clone() as unknown as Request)
    return fetchMock(request, ...args)
  })
})
afterEach(() => vi.unstubAllGlobals())

it("keeps field validation errors available to the form", async () => {
  const result = { ok: false, errors: { title: ["A title is required."] } }
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(result), {
      status: 422,
      headers: { "content-type": "application/json" },
    })
  )
  expect(await adminApi.savePost({ title: "" })).toEqual(result)
  expect(fetchMock).toHaveBeenCalledOnce()
  const request = requests[0]
  expect(request.method).toBe("POST")
  expect(await request.json()).toEqual({ title: "" })
})

it("rejects expired sessions without retrying a mutation", async () => {
  fetchMock.mockResolvedValue(new Response('{"ok":false}', { status: 401 }))
  await expect(adminApi.savePost({ title: "Draft" })).rejects.toBeInstanceOf(HTTPError)
  expect(fetchMock).toHaveBeenCalledOnce()
})

it("requests only public summaries with encoded search parameters", async () => {
  fetchMock.mockResolvedValue(
    new Response('{"posts":[],"page":2,"pageCount":2}', {
      headers: { "content-type": "application/json" },
    })
  )
  await writingApi.archive(
    parseArchiveOptions(new URLSearchParams("q=react+%26+workers&tag=react&page=2"))
  )
  const request = requests[0]
  const url = new URL(request.url)
  expect(url.pathname).toBe("/api/writing/posts")
  expect(url.searchParams.get("q")).toBe("react & workers")
  expect(url.searchParams.get("tag")).toBe("react")
  expect(url.searchParams.get("page")).toBe("2")
})

it("preserves combined archive filters and isolates their browser cache keys", async () => {
  const result = { posts: [], page: 2, pageCount: 2, total: 12 }
  fetchMock.mockResolvedValue(Response.json(result))
  const options = parseArchiveOptions(
    new URLSearchParams(
      "q=react+workers&tag=react&tag=typescript&sort=views&date=custom&from=2026-01-01&to=2026-09-30&duration=medium&page=2"
    )
  )
  expect(await writingApi.archive(options)).toEqual(result)
  const params = new URL(requests[0].url).searchParams
  expect(params.getAll("tag")).toEqual(["react", "typescript"])
  expect(Object.fromEntries(params)).toMatchObject({
    q: "react workers",
    sort: "views",
    date: "custom",
    from: "2026-01-01",
    to: "2026-09-30",
    duration: "medium",
    page: "2",
  })
  expect(writingKeys.archive(options)).not.toEqual(
    writingKeys.archive({ ...options, sort: "oldest" })
  )
})

it("passes route cancellation to the HTTP transport without retrying", async () => {
  fetchMock.mockImplementation((request) =>
    request.signal.aborted
      ? Promise.reject(new DOMException("The request was aborted", "AbortError"))
      : Promise.resolve(Response.json({ posts: [], page: 1, pageCount: 0, total: 0 }))
  )
  const controller = new AbortController()
  controller.abort()
  await expect(
    writingApi.archive(parseArchiveOptions(new URLSearchParams()), controller.signal)
  ).rejects.toMatchObject({ name: "AbortError" })
  expect(fetchMock).toHaveBeenCalledOnce()
  expect(requests[0].signal.aborted).toBe(true)
})

it("sends bounded JSON for preview and delete mutation endpoints", async () => {
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      new Response('{"ok":true}', { headers: { "content-type": "application/json" } })
    )
  )
  await adminApi.createPreviewLink("post-id")
  await adminApi.deletePost("post-id")
  expect(requests.map((request) => request.method)).toEqual(["POST", "DELETE"])
  expect(await requests[0].json()).toEqual({})
  expect(await requests[1].json()).toEqual({})
})

it("preserves private archive filters while keeping query keys invalidatable through the posts prefix", async () => {
  const result = { posts: [], total: 0, page: 1, pageCount: 0 }
  fetchMock.mockResolvedValue(Response.json(result))
  const options = parseAdminArchiveOptions(
    new URLSearchParams("status=draft&sort=newest&tag=react&tag=postgres&q=search")
  )
  expect(await adminApi.archive(options)).toEqual(result)
  const url = new URL(requests[0].url)
  expect(url.pathname).toBe("/api/admin/posts/archive")
  expect(url.searchParams.get("status")).toBe("draft")
  expect(url.searchParams.get("sort")).toBe("newest")
  expect(url.searchParams.getAll("tag")).toEqual(["postgres", "react"])
  expect(adminKeys.archive(options).slice(0, 2)).toEqual(adminKeys.posts)
  expect(adminKeys.archive(options)).not.toEqual(
    adminKeys.archive({ ...options, status: "published" })
  )
  expect(writingKeys.archive(options)[0]).not.toEqual(adminKeys.archive(options)[0])
  fetchMock.mockResolvedValueOnce(Response.json([]))
  await adminApi.tags()
  expect(new URL(requests[1].url).pathname).toBe("/api/admin/tags")
})
