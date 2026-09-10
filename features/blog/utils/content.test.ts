import { describe, expect, it } from "vitest"

import type { PostDocument } from "@/features/blog/types"

import { deriveExcerpt, plainText, renderDocument } from "./content"

/**
 * The render pipeline, and mostly the sanitiser.
 *
 * This is the code standing between the database and the reader. It was proved
 * once with a throwaway script during phase 2 and then again by hand after the
 * move to Tiptap; neither left anything behind that would fail if the ordering
 * of the pipeline were changed. This does.
 */

const doc = (...content: PostDocument[]): PostDocument => ({ type: "doc", content })
const text = (value: string): PostDocument => ({ type: "text", text: value })
const p = (...inline: PostDocument[]): PostDocument => ({ type: "paragraph", content: inline })

const link = (value: string, href: string): PostDocument => ({
  type: "text",
  text: value,
  marks: [{ type: "link", attrs: { href } }],
})

const render = (document: PostDocument) => renderDocument(document).then((result) => result.html)

describe("renderDocument — sanitising", () => {
  it("strips a javascript: image source the renderer happily emits", async () => {
    // The renderer does not judge attributes; it writes out whatever the stored
    // document says. Verified by rendering one - this is precisely why the
    // sanitiser is not a formality (threat T-2).
    const html = await render(
      doc({ type: "image", attrs: { src: "javascript:alert(1)", alt: "x" } })
    )

    expect(html).not.toContain("javascript:")
    expect(html).toContain("<img")
  })

  it("strips a javascript: link href", async () => {
    const html = await render(doc(p(link("click", "javascript:alert(1)"))))

    expect(html).not.toContain("javascript:")
    // The text survives; only the dangerous attribute goes.
    expect(html).toContain("click")
  })

  it("strips an http: image, because an https page cannot show it anyway", async () => {
    const html = await render(doc({ type: "image", attrs: { src: "http://insecure.test/x.png" } }))
    expect(html).not.toContain("http://insecure.test")
  })

  it("keeps an https image", async () => {
    const html = await render(doc({ type: "image", attrs: { src: "https://ok.test/x.png" } }))
    expect(html).toContain("https://ok.test/x.png")
  })

  it("escapes text rather than letting it become markup", async () => {
    const html = await render(doc(p(text('<script>alert(1)</script> & "quotes"'))))

    expect(html).not.toContain("<script>")
    expect(html).toContain("&#x3C;script>")
  })

  it("drops the inline styles the editor stores on a table", async () => {
    // Tiptap writes `style="min-width: 50px"` and a colgroup; the schema allows
    // neither, which is what keeps author-stored CSS off the page.
    const html = await render(
      doc({
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              {
                type: "tableHeader",
                attrs: { colspan: 1, rowspan: 1 },
                content: [p(text("Stage"))],
              },
            ],
          },
        ],
      })
    )

    expect(html).toContain("<table")
    expect(html).not.toContain("style=")
  })
})

describe("renderDocument — links", () => {
  it("sends an off-site link to a new tab with the rel that makes it safe", async () => {
    const html = await render(doc(p(link("elsewhere", "https://example.com/page"))))

    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it("leaves a same-site link in the tab", async () => {
    const html = await render(doc(p(link("home", "https://indrax.uk/blog"))))
    expect(html).not.toContain('target="_blank"')
  })

  it("sets rel itself rather than trusting the document", async () => {
    // The sanitiser allows neither `rel` nor `target` on an anchor, so a stored
    // `target="_blank"` with no `rel` cannot survive to reach a reader.
    const html = await render(
      doc(
        p({
          type: "text",
          text: "hostile",
          marks: [
            { type: "link", attrs: { href: "https://evil.test", target: "_blank", rel: "opener" } },
          ],
        })
      )
    )

    expect(html).not.toContain('rel="opener"')
    expect(html).toContain('rel="noopener noreferrer"')
  })
})

describe("renderDocument — heading structure", () => {
  const headings = (html: string) => (html.match(/<h[1-6]/g) ?? []).map((tag) => tag.slice(2))

  it("never emits an h1, because the page title is the h1", async () => {
    const html = await render(doc({ type: "heading", attrs: { level: 1 }, content: [text("Top")] }))

    expect(html).not.toContain("<h1")
  })

  it("starts at h2 whatever level the document was written at", async () => {
    // Two mechanisms enforce this and the test asserts the property rather than
    // either of them. `BLOG_EXTENSIONS` does not offer level 1, so the renderer
    // clamps a stored `h1` to `h2` before the rehype pass sees it; the shift in
    // `rehypeNormaliseHeadings` is the second line, for a document written
    // against a different extension set.
    const fromLevelOne = await render(
      doc(
        { type: "heading", attrs: { level: 1 }, content: [text("One")] },
        { type: "heading", attrs: { level: 2 }, content: [text("Two")] }
      )
    )

    expect(headings(fromLevelOne)[0]).toBe("2")
    expect(fromLevelOne).not.toContain("<h1")
  })

  it("never skips a level", async () => {
    const html = await render(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [text("Two")] },
        { type: "heading", attrs: { level: 3 }, content: [text("Three")] },
        { type: "heading", attrs: { level: 4 }, content: [text("Four")] }
      )
    )

    const levels = headings(html).map(Number)
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1)
    }
  })

  it("leaves a document already written at level 2 exactly as it is", async () => {
    // A blanket demotion would make this h3 and skip a level under the title.
    const html = await render(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [text("Two")] },
        { type: "heading", attrs: { level: 3 }, content: [text("Three")] }
      )
    )

    expect(headings(html)).toEqual(["2", "3"])
  })

  it("namespaces heading ids so they cannot clobber the DOM", async () => {
    // A heading slugging to `document` or `__next` is a named-window-access
    // surface; the prefix is what stops it.
    const html = await render(
      doc({ type: "heading", attrs: { level: 2 }, content: [text("document")] })
    )

    expect(html).toContain('id="user-content-document"')
  })
})

describe("renderDocument — accessibility of generated markup", () => {
  it("names each code block with its language and makes it a region", async () => {
    const html = await render(
      doc({ type: "codeBlock", attrs: { language: "ts" }, content: [text("const x = 1")] })
    )

    expect(html).toContain('aria-label="Code sample, ts"')
    expect(html).toContain('role="region"')
    expect(html).toContain('tabindex="0"')
  })

  it("emits both syntax palettes so switching theme needs no JavaScript", async () => {
    const html = await render(
      doc({ type: "codeBlock", attrs: { language: "ts" }, content: [text("const x = 1")] })
    )

    expect(html).toContain("--shiki-light")
    expect(html).toContain("--shiki-dark")
  })

  it("wraps a table in a named, focusable scroll region", async () => {
    const html = await render(
      doc({
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              { type: "tableCell", attrs: { colspan: 1, rowspan: 1 }, content: [p(text("a"))] },
            ],
          },
        ],
      })
    )

    expect(html).toContain('class="prose-scroll"')
    expect(html).toContain('aria-label="Table 1"')
  })

  it("labels a task-list checkbox with the item's own text", async () => {
    const html = await render(
      doc({
        type: "taskList",
        content: [{ type: "taskItem", attrs: { checked: true }, content: [p(text("Ship it"))] }],
      })
    )

    expect(html).toContain('aria-label="Ship it"')
  })
})

describe("renderDocument — table of contents", () => {
  it("collects level 2 and 3 headings, with the ids the links need", async () => {
    const { headings } = await renderDocument(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [text("First")] },
        { type: "heading", attrs: { level: 3 }, content: [text("Nested")] },
        { type: "heading", attrs: { level: 4 }, content: [text("Too deep")] }
      )
    )

    expect(headings).toEqual([
      { id: "user-content-first", text: "First", level: 2 },
      { id: "user-content-nested", text: "Nested", level: 3 },
    ])
  })

  it("returns nothing for a document with no headings", async () => {
    const { headings } = await renderDocument(doc(p(text("Just prose."))))
    expect(headings).toEqual([])
  })
})

describe("plainText", () => {
  it("joins the text of every node, in order", () => {
    expect(plainText(doc(p(text("One.")), p(text("Two."))))).toBe("One. Two.")
  })

  it("collapses whitespace", () => {
    expect(plainText(doc(p(text("  spaced   out  "))))).toBe("spaced out")
  })

  it("is empty for an empty document", () => {
    expect(plainText(doc())).toBe("")
    expect(plainText({ type: "doc" })).toBe("")
  })
})

describe("deriveExcerpt", () => {
  it("returns the whole text when it is short enough", () => {
    expect(deriveExcerpt(doc(p(text("Short enough."))))).toBe("Short enough.")
  })

  it("cuts on a word boundary rather than mid-word", () => {
    const long = doc(p(text("word ".repeat(80).trim())))
    const excerpt = deriveExcerpt(long, 40)

    expect(excerpt.endsWith("...")).toBe(true)
    expect(excerpt.length).toBeLessThanOrEqual(43)
    expect(excerpt).not.toMatch(/wor\.\.\.$/)
  })

  it("does not add an ellipsis it did not need", () => {
    expect(deriveExcerpt(doc(p(text("Fine."))), 40)).toBe("Fine.")
  })
})
