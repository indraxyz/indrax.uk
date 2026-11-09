import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"

import { PostTags } from "./post-tags"

const tags = Array.from({ length: 5 }, (_, index) => ({
  id: String(index),
  slug: `tag-${index}`,
  name: `Tag ${index}`,
}))
const render = (count: number) =>
  renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(PostTags, { tags: tags.slice(0, count) }))
  )

describe("post tag disclosure", () => {
  it("omits an empty navigation", () => expect(render(0)).toBe(""))

  it.each([1, 2])("shows %i tags without an unnecessary control", (count) => {
    const html = render(count)
    expect(html.match(/href=/g)).toHaveLength(count)
    expect(html).not.toContain("<button")
  })

  it("names the hidden count and connects the collapsed control to the remaining links", () => {
    const html = render(5)
    expect(html).toContain('aria-label="Show 3 more tags"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain(">+3</button>")
    const id = html.match(/aria-controls="([^"]+)"/)?.[1]
    expect(id).toBeTruthy()
    expect(html).toContain(`id="${id}" hidden=""`)
    expect(html).toContain('href="/writing?tag=tag-4"')
  })

  it("keeps admin tags as text while retaining the same disclosure", () => {
    const html = renderToStaticMarkup(createElement(PostTags, { tags, linkTags: false }))
    expect(html).toContain('role="group"')
    expect(html).not.toContain("href=")
    expect(html).not.toContain("z-10")
    expect(html).toContain('aria-label="Show 3 more tags"')
  })
})
