import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { PostDocument } from "@/features/writing/types"
import { renderDocument } from "@/features/writing/utils/content"

import { PostEditor } from "./editor"

vi.mock("@tiptap/react", () => ({
  useEditor: () => ({
    isActive: () => false,
    can: () =>
      new Proxy(
        {},
        {
          get: (_, command) =>
            command === "chain"
              ? () => ({ unsetAllMarks: () => ({ clearNodes: () => ({ run: () => true }) }) })
              : () => true,
        }
      ),
  }),
  useEditorState: () => 0,
  EditorContent: () => null,
}))

describe("PostEditor toolbar", () => {
  it("offers the supported primary formatting actions in one scrollable row", () => {
    const html = renderToStaticMarkup(createElement(PostEditor, { value: null, onChange: vi.fn() }))

    for (const label of [
      "Paragraph",
      "Underline",
      "Heading 2",
      "Heading 3",
      "Heading 4",
      "Horizontal rule",
      "Line break",
      "Clear formatting",
      "Undo",
      "Redo",
    ]) {
      expect(html).toContain(`aria-label="${label}"`)
    }
    expect(html).toContain('aria-orientation="horizontal"')
    expect(html).toContain("flex-nowrap")
    expect(html).toContain("overflow-x-auto")
    expect(html).not.toContain("flex-wrap ")
    expect(html).not.toContain('aria-label="Heading 1"')

    const buttons = html.match(/<button\b[^>]*>/g) ?? []
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      expect(button).toContain('type="button"')
      expect(button).toContain("size-11")
      expect(button).toContain("justify-center")
    }
  })

  it("preserves the added formatting controls in the published render pipeline", async () => {
    const document: PostDocument = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 4 }, content: [{ type: "text", text: "Details" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Underlined", marks: [{ type: "underline" }] },
            { type: "hardBreak" },
            { type: "text", text: "Next line" },
          ],
        },
        { type: "horizontalRule" },
      ],
    }
    const { html } = await renderDocument(document)

    expect(html).toContain("<u>Underlined</u>")
    expect(html).toContain("<br>")
    expect(html).toContain("<hr>")
    expect(html).toContain('<h4 id="user-content-details">Details</h4>')
  })
})
