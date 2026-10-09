import { afterEach, beforeEach, expect, it, vi, type Mock } from "vitest"
import { HTTPError } from "ky"

import { adminApi, writingApi } from "./client"

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
  await writingApi.posts(2, "react & workers")
  const request = requests[0]
  const url = new URL(request.url)
  expect(url.pathname).toBe("/api/writing/posts")
  expect(url.searchParams.get("tag")).toBe("react & workers")
  expect(url.searchParams.get("page")).toBe("2")
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
