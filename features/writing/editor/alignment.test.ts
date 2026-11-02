import { Editor } from "@tiptap/core"
import { describe, expect, it } from "vitest"

import { WRITING_EXTENSIONS } from "./extensions"
import { contentAlignment } from "./alignment"

const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] })
const image = {
  type: "image",
  attrs: { src: "https://images.example.com/a.png", width: 320, height: 160 },
}
const makeEditor = (content: object[]) =>
  new Editor({
    element: null,
    extensions: WRITING_EXTENSIONS,
    content: { type: "doc", content },
  })

describe("content alignment", () => {
  it.each(["left", "center", "right", "justify"])("accepts named text alignment %s", (value) => {
    expect(contentAlignment(value)).toBe(value)
  })

  it.each(["inherit", "start", "LEFT", "right; color:red", "center!important", null, 2])(
    "rejects arbitrary alignment %s",
    (value) => {
      expect(contentAlignment(value)).toBeNull()
    }
  )

  it("keeps media placement to left, center and right", () => {
    expect(contentAlignment("center", true)).toBe("center")
    expect(contentAlignment("justify", true)).toBeNull()
  })

  it("aligns selected text using the official command and leaves code blocks unchanged", () => {
    const editor = makeEditor([
      paragraph("Before"),
      { type: "codeBlock", content: [{ type: "text", text: "code" }] },
    ])
    editor.commands.setTextSelection(2)
    expect(editor.commands.setTextAlign("justify")).toBe(true)
    expect(editor.getJSON().content?.[0].attrs?.textAlign).toBe("justify")
    editor.commands.selectAll()
    editor.commands.setTextAlign("right")
    expect(editor.getJSON().content?.[1].attrs?.textAlign).toBeUndefined()
    expect(editor.commands.setTextAlign("inherit")).toBe(false)
    editor.destroy()
  })

  it("positions images without changing their dimensions and refuses media justification", () => {
    const editor = makeEditor([image, paragraph("After")])
    editor.commands.setNodeSelection(0)
    expect(editor.can().setTextAlign("justify")).toBe(false)
    expect(editor.commands.setTextAlign("justify")).toBe(false)
    expect(editor.commands.setTextAlign("right")).toBe(true)
    expect(editor.getJSON().content?.[0].attrs).toMatchObject({
      textAlign: "right",
      width: 320,
      height: 160,
    })
    editor.commands.unsetTextAlign()
    expect(editor.getJSON().content?.[0].attrs?.textAlign).toBeNull()
    editor.destroy()
  })

  it("justifies text in a mixed selection while retaining image placement", () => {
    const editor = makeEditor([
      paragraph("Before"),
      { ...image, attrs: { ...image.attrs, textAlign: "center" } },
      paragraph("After"),
    ])
    editor.commands.selectAll()
    expect(editor.commands.setTextAlign("justify")).toBe(true)
    const content = editor.getJSON().content!
    expect(content[0].attrs?.textAlign).toBe("justify")
    expect(content[1].attrs?.textAlign).toBe("center")
    expect(content[2].attrs?.textAlign).toBe("justify")
    editor.destroy()
  })

  it("positions selected video blocks and disables justification", () => {
    const editor = makeEditor([
      { type: "youtube", attrs: { src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } },
      paragraph("After"),
    ])
    editor.commands.setNodeSelection(0)
    expect(editor.can().setTextAlign("justify")).toBe(false)
    expect(editor.commands.setTextAlign("center")).toBe(true)
    expect(editor.getJSON().content?.[0].attrs?.textAlign).toBe("center")
    editor.destroy()
  })
})
