import { expect, it, vi } from "vitest"

import { renderDocument } from "./content"

it("highlights code when runtime WebAssembly compilation is unavailable", async () => {
  // A fresh test file has no initialized highlighter to hide a cold-start failure.
  const denyWasm = () => {
    throw new Error("Wasm code generation disallowed by embedder")
  }
  const instantiate = vi.spyOn(WebAssembly, "instantiate").mockImplementation(denyWasm)
  const compile = vi.spyOn(WebAssembly, "compile").mockImplementation(denyWasm)

  try {
    for (const [language, source] of [
      ["ts", "const value: number = 1"],
      ["php", "<?php echo 'Hello';"],
      ["sql", "SELECT title FROM posts;"],
    ]) {
      const { html } = await renderDocument({
        type: "doc",
        content: [
          {
            type: "codeBlock",
            attrs: { language },
            content: [{ type: "text", text: source }],
          },
        ],
      })

      expect(html).toContain("--shiki-light")
      expect(html).toContain("--shiki-dark")
      expect(html).toContain(`aria-label="Code sample, ${language}"`)
    }
    expect(instantiate).not.toHaveBeenCalled()
    expect(compile).not.toHaveBeenCalled()
  } finally {
    vi.restoreAllMocks()
  }
})
