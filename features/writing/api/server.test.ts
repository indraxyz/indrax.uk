import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  previewPost: vi.fn(),
  verifyToken: vi.fn(),
  render: vi.fn(),
  author: vi.fn(),
  save: vi.fn(),
  list: vi.fn(),
  edit: vi.fn(),
  overview: vi.fn(),
  adminArchive: vi.fn(),
  adminTags: vi.fn(),
  remove: vi.fn(),
  status: vi.fn(),
  preview: vi.fn(),
  posts: vi.fn(),
  archive: vi.fn(),
  tags: vi.fn(),
  recent: vi.fn(),
  search: vi.fn(),
  series: vi.fn(),
  tagPosts: vi.fn(),
  log: vi.fn(),
}))
vi.mock("@/lib/auth-guard", () => ({ getAuthor: mocks.author }))
vi.mock("@/lib/auth", () => ({ isAuthConfigured: () => true }))
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }))
vi.mock("@/lib/cover-storage", () => ({ getCoverStorageConfig: () => null }))
vi.mock("@/lib/observability", () => ({ logServerError: mocks.log }))
vi.mock("@/features/writing/data/admin-queries", () => ({
  getAdminOverview: mocks.overview,
  getAdminArchivePosts: mocks.adminArchive,
  getAdminTagsInUse: mocks.adminTags,
  listAllPosts: mocks.list,
  getPostForEdit: mocks.edit,
}))
vi.mock("@/features/writing/data/mutations", () => ({
  savePost: mocks.save,
  setPostStatus: mocks.status,
  deletePost: mocks.remove,
  createPreviewLink: mocks.preview,
}))
vi.mock("@/features/writing/data/queries", () => ({
  getPostForPreview: mocks.previewPost,
  getPublishedPosts: mocks.posts,
  getArchivePosts: mocks.archive,
  getPostsByTag: mocks.tagPosts,
  getTagsInUse: mocks.tags,
  getRecentPosts: mocks.recent,
  searchPosts: mocks.search,
  getSeriesBySlug: mocks.series,
}))

vi.mock("@/features/writing/utils/preview-token", () => ({ verifyPreviewToken: mocks.verifyToken }))
vi.mock("@/features/writing/utils/content", () => ({ renderDocument: mocks.render }))

import { handleWritingApi } from "./server"
const origin = "https://example.test"
const id = "550e8400-e29b-41d4-a716-446655440000"
function request(path: string, method = "GET", body?: unknown, headers?: Record<string, string>) {
  return new Request(origin + path, {
    method,
    headers: { origin, "content-type": "application/json", ...headers },
    ...(method !== "GET" ? { body: JSON.stringify(body ?? {}) } : {}),
  })
}
async function response(input: Request) {
  const result = await handleWritingApi(input)
  expect(result).not.toBeNull()
  expect(result!.headers.get("cache-control")).toBe("no-store")
  return result!
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.author.mockResolvedValue({ id: "author", name: "Author" })
  mocks.archive.mockResolvedValue({ posts: [], page: 1, pageCount: 0, total: 0 })
  mocks.save.mockResolvedValue({ ok: true, postId: id })
  mocks.status.mockResolvedValue({ ok: true, postId: id })
  mocks.remove.mockResolvedValue({ ok: true })
  mocks.preview.mockResolvedValue({ ok: true, url: "/writing/draft/preview?token=signed" })
})
describe("writing HTTP API", () => {
  it("validates preview credentials before database reads or rendering", async () => {
    for (const query of [
      "",
      "?token=bad",
      "?token=signed.token&token=signed.token",
      "?token=" + "x".repeat(1100),
    ]) {
      const result = await response(request("/api/writing/preview/draft" + query))
      expect(result.status).toBe(404)
      expect(result.headers.get("referrer-policy")).toBe("no-referrer")
    }
    expect(mocks.verifyToken).not.toHaveBeenCalled()
    expect(mocks.previewPost).not.toHaveBeenCalled()
    expect(mocks.render).not.toHaveBeenCalled()
  })
  it("does not query or render drafts with invalid or expired signatures", async () => {
    mocks.verifyToken.mockResolvedValue(false)
    expect((await response(request("/api/writing/preview/draft?token=signed.token"))).status).toBe(
      404
    )
    expect(mocks.verifyToken).toHaveBeenCalledWith("signed.token", "draft")
    expect(mocks.previewPost).not.toHaveBeenCalled()
    expect(mocks.render).not.toHaveBeenCalled()
  })
  it("returns signed preview HTML without caching or leaking the raw document", async () => {
    mocks.verifyToken.mockResolvedValue(true)
    const content = { type: "doc", content: [] }
    mocks.previewPost.mockResolvedValue({ slug: "draft", status: "draft", content })
    mocks.render.mockResolvedValue({ html: "<p>Draft</p>", headings: [] })
    const result = await response(request("/api/writing/preview/draft?token=signed.token"))
    expect(await result.json()).toEqual({
      post: { slug: "draft", status: "draft" },
      article: { html: "<p>Draft</p>", headings: [] },
    })
    expect(mocks.previewPost).toHaveBeenCalledWith("draft")
    expect(mocks.render).toHaveBeenCalledWith(content)
    expect(mocks.author).not.toHaveBeenCalled()
  })
  it("treats a valid token for a missing post as a private 404", async () => {
    mocks.verifyToken.mockResolvedValue(true)
    mocks.previewPost.mockResolvedValue(null)
    expect((await response(request("/api/writing/preview/draft?token=signed.token"))).status).toBe(
      404
    )
    expect(mocks.render).not.toHaveBeenCalled()
  })
  it("leaves unrelated routes to their handler", async () => {
    expect(await handleWritingApi(request("/api/auth/get-session"))).toBeNull()
  })
  it("public lists use exclusively published query functions without admin authentication", async () => {
    const result = await response(request("/api/writing/posts?page=1000000"))
    expect(await result.json()).toEqual({ posts: [], page: 1, pageCount: 0, total: 0 })
    expect(mocks.archive).toHaveBeenCalledWith(expect.objectContaining({ page: 1000 }))
    expect(mocks.list).not.toHaveBeenCalled()
    expect(mocks.author).not.toHaveBeenCalled()
  })
  it("bounds and normalizes pagination and recent limits before data/cache access", async () => {
    await response(request("/api/writing/posts?page=NaN"))
    expect(mocks.archive).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }))
    await response(request("/api/writing/recent?limit=99999"))
    expect(mocks.recent).toHaveBeenCalledWith(10)
    await response(request("/api/writing/search?q=hello&page=999"))
    expect(mocks.search).toHaveBeenCalledWith("hello", 20)
  })
  it("rejects invalid tag keys without reaching the database", async () => {
    expect((await response(request("/api/writing/posts?tag=bad%20tag"))).status).toBe(400)
    expect(mocks.archive).not.toHaveBeenCalled()
  })
  it("passes combined filters and bounded relevance pagination to the archive", async () => {
    await response(
      request(
        "/api/writing/posts?q=database&tag=react&tag=postgres&sort=relevance&date=custom&from=2026-01-01&to=2026-02-01&duration=medium&page=500"
      )
    )
    expect(mocks.archive).toHaveBeenCalledWith({
      q: "database",
      tags: ["postgres", "react"],
      sort: "relevance",
      date: "custom",
      from: "2026-01-01",
      to: "2026-02-01",
      duration: "medium",
      page: 20,
    })
  })
  it.each([
    "?q=" + "x".repeat(121),
    "?" + Array.from({ length: 11 }, (_, i) => `tag=tag-${i}`).join("&"),
    "?date=custom&from=2026-02-30",
    "?date=custom&from=2026-02-01&to=2026-01-01",
    "?date=custom",
  ])("rejects invalid archive inputs before any data access: %s", async (query) => {
    expect((await response(request("/api/writing/posts" + query))).status).toBe(400)
    expect(mocks.archive).not.toHaveBeenCalled()
  })
  it("serves filtered private archives and all-status tag counts only to the author", async () => {
    mocks.adminArchive.mockResolvedValue({ posts: [], total: 0, page: 1, pageCount: 0 })
    mocks.adminTags.mockResolvedValue([{ slug: "draft-tag", postCount: 2 }])
    expect(
      (
        await response(
          request(
            "/api/admin/posts/archive?status=draft&q=body&tag=react&sort=relevance&duration=short&page=900"
          )
        )
      ).status
    ).toBe(200)
    expect(mocks.adminArchive).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "draft",
        q: "body",
        tags: ["react"],
        sort: "relevance",
        duration: "short",
        page: 20,
      })
    )
    expect(await (await response(request("/api/admin/tags"))).json()).toEqual([
      { slug: "draft-tag", postCount: 2 },
    ])
    mocks.author.mockResolvedValue(null)
    expect((await response(request("/api/admin/posts/archive"))).status).toBe(401)
    expect((await response(request("/api/admin/tags"))).status).toBe(401)
    expect(mocks.adminArchive).toHaveBeenCalledTimes(1)
    expect(mocks.adminTags).toHaveBeenCalledTimes(1)
  })
  it("validates private archive filters before querying", async () => {
    expect(
      (await response(request("/api/admin/posts/archive?date=custom&from=2026-02-30"))).status
    ).toBe(400)
    expect(mocks.adminArchive).not.toHaveBeenCalled()
  })
  it("does not expose private data to an unauthenticated caller", async () => {
    mocks.author.mockResolvedValue(null)
    for (const path of [
      "/api/admin/posts",
      "/api/admin/posts/archive",
      "/api/admin/tags",
      "/api/admin/overview",
      `/api/admin/posts/${id}`,
    ])
      expect((await response(request(path))).status).toBe(401)
    expect(mocks.list).not.toHaveBeenCalled()
    expect(mocks.edit).not.toHaveBeenCalled()
    expect(mocks.overview).not.toHaveBeenCalled()
  })
  it("returns anonymous session state for the login UI without drafts or storage details", async () => {
    mocks.author.mockResolvedValue(null)
    const result = await response(request("/api/admin/session"))
    expect(result.status).toBe(200)
    expect(await result.json()).toMatchObject({
      author: null,
      authConfigured: true,
      coverUploadsConfigured: false,
      previewConfigured: false,
    })
  })
  it.each([undefined, "https://evil.test"])(
    "rejects mutation from an absent or foreign origin (%s)",
    async (value) => {
      const input = request("/api/admin/posts", "POST", { title: "Draft" })
      if (value) input.headers.set("origin", value)
      else input.headers.delete("origin")
      expect((await response(input)).status).toBe(403)
      expect(mocks.save).not.toHaveBeenCalled()
    }
  )
  it("rejects non-JSON requests and malformed JSON before save", async () => {
    expect(
      (await response(request("/api/admin/posts", "POST", {}, { "content-type": "text/plain" })))
        .status
    ).toBe(415)
    expect(
      (
        await response(
          new Request(origin + "/api/admin/posts", {
            method: "POST",
            headers: { origin, "content-type": "application/json" },
            body: "{",
          })
        )
      ).status
    ).toBe(400)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it("bounds streamed bodies without Content-Length before parsing or save", async () => {
    const input = request("/api/admin/posts", "POST", { content: "x".repeat(512 * 1024) })
    expect(input.headers.has("content-length")).toBe(false)
    expect((await response(input)).status).toBe(413)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it("rejects oversized declared lengths without reading the body", async () => {
    expect(
      (await response(request("/api/admin/posts", "POST", {}, { "content-length": "999999" })))
        .status
    ).toBe(413)
    expect(mocks.save).not.toHaveBeenCalled()
  })
  it("returns field validation from the guarded mutation rather than validating the document twice", async () => {
    mocks.save.mockResolvedValue({
      ok: false,
      message: "That could not be saved.",
      errors: { title: ["Required"] },
    })
    const result = await response(request("/api/admin/posts", "POST", { title: "" }))
    expect(result.status).toBe(422)
    expect(await result.json()).toMatchObject({ errors: { title: ["Required"] } })
    expect(mocks.save).toHaveBeenCalledWith({ title: "" })
  })
  it("returns missing private posts as 404 and validates ids before querying", async () => {
    mocks.edit.mockResolvedValue(null)
    expect((await response(request(`/api/admin/posts/${id}`))).status).toBe(404)
    mocks.edit.mockClear()
    expect((await response(request("/api/admin/posts/not-a-uuid"))).status).toBe(404)
    expect(mocks.edit).not.toHaveBeenCalled()
  })
  it("does not reveal internal error details", async () => {
    mocks.list.mockRejectedValue(new Error("postgres password secret"))
    const result = await response(request("/api/admin/posts"))
    expect(result.status).toBe(500)
    expect(await result.text()).not.toContain("secret")
    expect(mocks.log).toHaveBeenCalledOnce()
  })
  it("protects delete, status and preview mutations with the same origin boundary", async () => {
    for (const [path, method] of [
      [`/api/admin/posts/${id}`, "DELETE"],
      [`/api/admin/posts/${id}/status`, "PATCH"],
      [`/api/admin/posts/${id}/preview`, "POST"],
    ]) {
      expect(
        (
          await response(
            request(path, method, { status: "published" }, { origin: "https://evil.test" })
          )
        ).status
      ).toBe(403)
    }
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.status).not.toHaveBeenCalled()
    expect(mocks.preview).not.toHaveBeenCalled()
  })
  it("handles status and preview DTOs", async () => {
    expect(
      (await response(request(`/api/admin/posts/${id}/status`, "PATCH", { status: "published" })))
        .status
    ).toBe(200)
    expect(mocks.status).toHaveBeenCalledWith(id, "published")
    expect(
      (await response(request(`/api/admin/posts/${id}/status`, "PATCH", { status: "garbage" })))
        .status
    ).toBe(422)
    const result = await response(request(`/api/admin/posts/${id}/preview`, "POST"))
    expect(await result.json()).toMatchObject({ url: expect.stringContaining("token=signed") })
  })
})
