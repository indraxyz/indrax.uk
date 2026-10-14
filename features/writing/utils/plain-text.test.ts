import { describe, expect, it, vi } from "vitest"

// Save/seed only need text. Importing this helper must not load the renderer or
// its expensive editor/highlighting dependencies.
vi.mock("@tiptap/static-renderer/pm/html-string", () => {
  throw new Error("Text extraction must not load Tiptap's renderer")
})
vi.mock("shiki", () => {
  throw new Error("Text extraction must not load Shiki")
})

import { deriveExcerpt, deriveExcerptText, plainText } from "./plain-text"

const document = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: " One  two " }] },
    { type: "paragraph", content: [{ type: "text", text: "three four" }] },
  ],
}

describe("lightweight document text", () => {
  it("extracts normalised text without importing rendering dependencies", () => {
    expect(plainText(document)).toBe("One two three four")
  })

  it("derives the same word-boundary excerpt from a document or precomputed text", () => {
    expect(deriveExcerpt(document, 14)).toBe("One two three...")
    expect(deriveExcerptText(plainText(document), 14)).toBe(deriveExcerpt(document, 14))
  })

  it("preserves empty text and truncates a long word consistently", () => {
    expect(deriveExcerptText("")).toBe("")
    expect(deriveExcerptText("abcdefghij", 4)).toBe("abcd...")
  })
})
