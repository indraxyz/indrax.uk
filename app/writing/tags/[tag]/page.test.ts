import { beforeEach, describe, expect, it, vi } from "vitest"

const { connection, getTagsInUse, getPostsByTag, notFound } = vi.hoisted(() => ({
  connection: vi.fn(),
  getTagsInUse: vi.fn(),
  getPostsByTag: vi.fn(),
  notFound: vi.fn(),
}))

vi.mock("next/server", () => ({ connection }))
vi.mock("next/navigation", () => ({ notFound }))
vi.mock("@/features/writing/data/queries", () => ({ getTagsInUse, getPostsByTag }))

import TagPage, { generateMetadata } from "./page"

const props = (page?: string, tag = "article") => ({
  params: Promise.resolve({ tag }),
  searchParams: Promise.resolve({ page }),
})

beforeEach(() => {
  vi.resetAllMocks()
  connection.mockResolvedValue(undefined)
  getTagsInUse.mockResolvedValue([{ id: "tag-id", name: "Article", slug: "article" }])
  getPostsByTag.mockResolvedValue({ posts: [], page: 1, pageCount: 0 })
  notFound.mockImplementation(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404")
  })
})

describe("request-rendered tag pages", () => {
  it.each([TagPage, generateMetadata])(
    "establishes the request boundary before queries run",
    async (render) => {
      // Prerendering must stop before data can turn a request-dependent route
      // into a stale ISR page. Propagate Next's control flow unchanged.
      const bailout = Object.assign(new Error("dynamic rendering"), {
        digest: "DYNAMIC_SERVER_USAGE",
      })
      connection.mockRejectedValue(bailout)

      await expect(render(props("2"))).rejects.toBe(bailout)
      expect(getTagsInUse).not.toHaveBeenCalled()
      expect(getPostsByTag).not.toHaveBeenCalled()
    }
  )

  it("passes bounded request pagination to the cached query", async () => {
    await TagPage(props("1000000"))

    expect(connection).toHaveBeenCalledOnce()
    expect(getPostsByTag).toHaveBeenCalledWith("article", 1000)
  })

  it("keeps page two indexable with its own canonical and title", async () => {
    const metadata = await generateMetadata(props("2"))

    expect(metadata.alternates?.canonical).toBe("/writing/tags/article?page=2")
    expect(metadata.openGraph?.url).toBe("/writing/tags/article?page=2")
    expect(metadata.title).toBe("Article - page 2 - Writing")
    expect(metadata.robots).toEqual({ index: true, follow: true })
  })

  it("normalises invalid pagination in canonical metadata", async () => {
    const metadata = await generateMetadata(props("-1"))

    expect(metadata.alternates?.canonical).toBe("/writing/tags/article")
  })

  it("returns a nonindexable 404 for tags without published posts", async () => {
    const missing = props(undefined, "draft-only")

    expect(await generateMetadata(missing)).toEqual({
      title: "Not found",
      robots: { index: false, follow: false },
    })
    await expect(TagPage(missing)).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404")
    expect(getPostsByTag).not.toHaveBeenCalled()
  })
})
