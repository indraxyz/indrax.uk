import type { Root } from "hast"
import rehypePrettyCode from "rehype-pretty-code"
import { createHighlighter } from "./shiki-bundle"
import { unified } from "unified"

// Shiki themes for the two site themes. Both are emitted in one pass as
// `--shiki-light` / `--shiki-dark` custom properties, and `app/globals.css`
// chooses between them off the `.dark` class - so switching theme repaints code
// without a second render and without shipping a highlighter to the browser.
//
// The light theme is the high-contrast variant because the ordinary one is not
// accessible on this surface: axe measured its red at 4.42:1, its green at 4.47:1
// and its orange at 3.37:1 against `--component-prose-code-bg`, all short of the
// 4.5:1 that WCAG AA asks of body text (NFR-4). Syntax highlighting is text.
// `github-dark` already clears the bar against the darker dark-mode surface.
const CODE_THEMES = { light: "github-light-high-contrast", dark: "github-dark" } as const

// Freeze once so Pretty Code's cached highlighter and language grammars are
// reused for subsequent articles in the same Worker isolate.
const processor = unified()
  .use(rehypePrettyCode, {
    theme: CODE_THEMES,
    // Cloudflare Workers cannot dynamically compile Oniguruma's WASM.
    getHighlighter: (options) => createHighlighter(options),
    keepBackground: false,
  })
  .freeze()

export function highlightCode(tree: Root): Promise<Root> {
  return processor.run(tree)
}
