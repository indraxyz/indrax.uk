import { expect, it, vi } from "vitest"
const get = vi.hoisted(() => vi.fn())
vi.mock("@/lib/api-client", () => ({ api: { get } }))

import { fetchPreview, headers, meta } from "@/app/routes/writing-preview"

it("requests the signed API with the requested slug and without browser cache or referrer", async () => {
  const json = vi
    .fn()
    .mockResolvedValue({ post: { slug: "draft" }, article: { html: "<p>Preview</p>" } })
  get.mockReturnValue({ json })
  await fetchPreview("draft", "signed-token")
  expect(get).toHaveBeenCalledWith("/api/writing/preview/draft", {
    searchParams: { token: "signed-token" },
    cache: "no-store",
    referrerPolicy: "no-referrer",
  })
})

it("never allows draft preview responses to be cached, indexed, or leak the token as referrer", () => {
  expect(headers()).toEqual({
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  })
  expect(meta()).toContainEqual({ name: "robots", content: "noindex, nofollow, noarchive" })
  expect(meta()).toContainEqual({ name: "referrer", content: "no-referrer" })
})
