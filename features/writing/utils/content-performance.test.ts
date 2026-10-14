import { describe, expect, it, vi } from "vitest"

import type { PostDocument } from "@/features/writing/types"

const { createHighlighter } = vi.hoisted(() => ({ createHighlighter: vi.fn() }))
vi.mock("./shiki-bundle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./shiki-bundle")>()
  createHighlighter.mockImplementation(actual.createHighlighter)
  return { ...actual, createHighlighter }
})

import { renderDocument } from "./content"

const doc = (...content: PostDocument[]): PostDocument => ({ type: "doc", content })
const code = (text: string): PostDocument => ({ type: "text", text, marks: [{ type: "code" }] })

describe("renderDocument — CPU-sensitive highlighting", () => {
  it("does not initialise Shiki for prose, tables, or unannotated inline code", async () => {
    await renderDocument(
      doc(
        {
          type: "paragraph",
          content: [{ type: "text", text: "Just prose." }, code("const x = 1")],
        },
        { type: "codeBlock", content: [{ type: "text", text: "No language selected" }] },
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [code("x")] }] },
              ],
            },
          ],
        }
      )
    )

    expect(createHighlighter).not.toHaveBeenCalled()
  })

  it("highlights annotated inline code using the JavaScript engine without compiling WASM", async () => {
    const compile = vi.spyOn(WebAssembly, "compile").mockRejectedValue(new Error("WASM disabled"))
    const instantiate = vi
      .spyOn(WebAssembly, "instantiate")
      .mockRejectedValue(new Error("WASM disabled"))

    try {
      const result = await renderDocument(
        doc({ type: "paragraph", content: [code("const x = 1{:ts}")] })
      )
      expect(result.html).toContain("--shiki-light")
      expect(result.html).toContain("--shiki-dark")
      expect(result.html).not.toContain("{:ts}")
      expect(createHighlighter).toHaveBeenCalledTimes(1)
      expect(compile).not.toHaveBeenCalled()
      expect(instantiate).not.toHaveBeenCalled()
    } finally {
      compile.mockRestore()
      instantiate.mockRestore()
    }
  })

  it("preserves Pretty Code's literal formatting for escaped inline annotations", async () => {
    const result = await renderDocument(doc({ type: "paragraph", content: [code("x\\{:ts}")] }))
    expect(result.html).toContain("<code>x{:ts}</code>")
  })

  it("reuses the highlighter for subsequent language blocks and still sanitises authored attributes", async () => {
    const result = await renderDocument(
      doc(
        {
          type: "codeBlock",
          attrs: { language: "ts" },
          content: [{ type: "text", text: "const y = 2" }],
        },
        { type: "image", attrs: { src: "javascript:alert(1)" } }
      )
    )

    expect(result.html).toContain("--shiki-light")
    expect(result.html).not.toContain("javascript:")
    expect(createHighlighter).toHaveBeenCalledTimes(1)
  })
})
