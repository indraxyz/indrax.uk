import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router"
import { expect, it } from "vitest"
import { TagPill } from "./tag-pill"

it("links article tags into the unified archive with the published count as readable text", () => {
  const html = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(TagPill, {
        tag: { id: "tag-id", slug: "typescript", name: "TypeScript" },
        count: 4,
      })
    )
  )
  expect(html).toContain('href="/writing?tag=typescript"')
  expect(html).toContain("TypeScript")
  expect(html).toContain("(4)")
  expect(html).not.toContain("/writing/tags/")
})
