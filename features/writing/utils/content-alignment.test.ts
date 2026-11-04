import { describe, expect, it } from "vitest"

import type { PostDocument } from "@/features/writing/types"
import { renderDocument } from "./content"

const render = (...content: PostDocument[]) =>
  renderDocument({ type: "doc", content }).then(({ html }) => html)

const text = { type: "text", text: "Aligned content" }

describe("rendered article alignment", () => {
  it.each(["left", "center", "right", "justify"])(
    "preserves text alignment %s without authored styles",
    async (textAlign) => {
      const html = await render({ type: "paragraph", attrs: { textAlign }, content: [text] })
      expect(html).toContain(`<p data-align="${textAlign}">`)
      expect(html).not.toContain("style=")
    }
  )

  it("preserves heading and nested list/quote paragraph alignment", async () => {
    const html = await render(
      { type: "heading", attrs: { level: 3, textAlign: "right" }, content: [text] },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", attrs: { textAlign: "center" }, content: [text] }],
          },
        ],
      },
      {
        type: "blockquote",
        content: [{ type: "paragraph", attrs: { textAlign: "justify" }, content: [text] }],
      }
    )
    expect(html).toMatch(/<h3[^>]*data-align="right"/)
    expect(html).toContain('<li><p data-align="center">')
    expect(html).toContain('<blockquote><p data-align="justify">')
  })

  it("preserves cell alignment and inner text", async () => {
    const html = await render({
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              attrs: { textAlign: "right" },
              content: [{ type: "paragraph", content: [text] }],
            },
          ],
        },
      ],
    })
    expect(html).toMatch(/<td[^>]*data-align="right"/)
    expect(html).toContain("Aligned content")
  })

  it.each(["left", "center", "right"])(
    "preserves image placement %s and dimensions",
    async (textAlign) => {
      const html = await render({
        type: "image",
        attrs: { src: "https://images.example.com/a.png", width: 320, height: 160, textAlign },
      })
      expect(html).toContain(`data-align="${textAlign}"`)
      expect(html).toContain('width="320"')
      expect(html).toContain('height="160"')
      expect(html).not.toContain("style=")
    }
  )

  it.each(["right; color:red", "center!important", "inherit"])(
    "drops malformed stored alignment %s",
    async (textAlign) => {
      const html = await render({ type: "paragraph", attrs: { textAlign }, content: [text] })
      expect(html).not.toContain("data-align")
      expect(html).not.toContain("style=")
      expect(html).toContain("Aligned content")
    }
  )

  it("drops justification for media and alignment for code blocks", async () => {
    const html = await render(
      { type: "image", attrs: { src: "https://images.example.com/a.png", textAlign: "justify" } },
      { type: "codeBlock", attrs: { textAlign: "right" }, content: [text] }
    )
    expect(html).not.toContain("data-align")
  })
})
