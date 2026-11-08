import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"

import { ShareLink, copyWritingLink, writingShareUrl } from "./share-link"

it("copies a canonical article URL with no inherited preview credentials or fragment", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  await copyWritingLink("article-slug", { writeText })
  expect(writeText).toHaveBeenCalledWith(writingShareUrl("article-slug"))
  expect(new URL(writingShareUrl("article-slug")).pathname).toBe("/writing/article-slug")
  expect(new URL(writingShareUrl("article-slug")).search).toBe("")
  expect(new URL(writingShareUrl("article-slug")).hash).toBe("")
})

it("does not report denied clipboard access as success", async () => {
  await expect(
    copyWritingLink("article-slug", { writeText: vi.fn().mockRejectedValue(new Error("Denied")) })
  ).rejects.toThrow("Denied")
})

it("names the icon action and exposes an announcement region", () => {
  const html = renderToStaticMarkup(createElement(ShareLink, { slug: "article-slug" }))
  expect(html).toContain('aria-label="Copy article link"')
  expect(html).toContain('role="status"')
})
