import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { TableOfContents, buildContentsTree } from "./table-of-contents"

describe("article contents hierarchy", () => {
  it("nests h3 and h4 beneath their main headings and resets at the next h2", () => {
    expect(
      buildContentsTree([
        { id: "main", text: "Main", level: 2 },
        { id: "sub", text: "Sub", level: 3 },
        { id: "detail", text: "Detail", level: 4 },
        { id: "next-sub", text: "Next sub", level: 3 },
        { id: "next", text: "Next", level: 2 },
      ])
    ).toEqual([
      {
        id: "main",
        text: "Main",
        level: 2,
        children: [
          {
            id: "sub",
            text: "Sub",
            level: 3,
            children: [{ id: "detail", text: "Detail", level: 4, children: [] }],
          },
          { id: "next-sub", text: "Next sub", level: 3, children: [] },
        ],
      },
      { id: "next", text: "Next", level: 2, children: [] },
    ])
  })

  it("handles a document beginning with h3 or skipping from h2 to h4 without fake parents", () => {
    const tree = buildContentsTree([
      { id: "opening-sub", text: "Opening sub", level: 3 },
      { id: "opening-detail", text: "Opening detail", level: 4 },
      { id: "main", text: "Main", level: 2 },
      { id: "detail", text: "Detail", level: 4 },
    ])
    expect(tree.map(({ id }) => id)).toEqual(["opening-sub", "main"])
    expect(tree[0].children.map(({ id }) => id)).toEqual(["opening-detail"])
    expect(tree[1].children.map(({ id }) => id)).toEqual(["detail"])
  })

  it("keeps one-heading articles navigable and emits native anchors/disclosure without JS", () => {
    const html = renderToStaticMarkup(
      createElement(TableOfContents, {
        entries: [{ id: "user-content-one", text: "One <heading>", level: 2 }],
      })
    )
    expect(html).toContain("<details")
    expect(html).toContain("<summary")
    expect(html).toContain('href="#user-content-one"')
    expect(html).toContain("One &lt;heading&gt;")
    expect(html).not.toContain('id="toc-heading"')
    expect(html).toContain('data-enhanced="false"')
  })

  it("omits navigation when there are no headings", () => {
    expect(renderToStaticMarkup(createElement(TableOfContents, { entries: [] }))).toBe("")
  })
})
