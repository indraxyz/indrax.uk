import { renderToHTMLString } from "@tiptap/static-renderer/pm/html-string"
import rehypeParse from "rehype-parse"
import rehypePrettyCode from "rehype-pretty-code"
import rehypeSanitize, { defaultSchema, type Options as Schema } from "rehype-sanitize"
import rehypeSlug from "rehype-slug"
import rehypeStringify from "rehype-stringify"
import { unified } from "unified"

import type { Element, Root as HastRoot } from "hast"

import { SITE_URL } from "@/features/resume/config"

import { BLOG_EXTENSIONS } from "@/features/blog/editor/extensions"
import type { PostDocument, RenderedArticle, TocEntry } from "@/features/blog/types"

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

const HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const

const headingLevel = (tagName: string) => HEADING_LEVELS.find((level) => tagName === `h${level}`)

/**
 * Normalise headings so the shallowest one is an `<h2>`.
 *
 * The article's own `<h1>` is the post title, so nothing in the body may be one -
 * two of them is both a validity error and a real problem for anyone navigating by
 * heading. But a blanket demotion is not the answer either: it would turn a
 * document written with `h2` into `h3`, and `h1` to `h3` skips a level, which is
 * the other half of the same criterion (PRD US-1.1).
 *
 * In practice this never fires. `BLOG_EXTENSIONS` does not offer level 1, so the
 * renderer already clamps a stored `h1` to `h2` before this sees the tree -
 * confirmed by rendering one. It stays because the extension set is explicitly a
 * thing that can change (see the note on `BLOG_EXTENSIONS`), and a document
 * written against a different one must still not produce a second `<h1>`. The
 * property is asserted in `content.test.ts` rather than the mechanism, so either
 * line of defence satisfies it.
 */
function rehypeNormaliseHeadings() {
  return (tree: HastRoot) => {
    const headings: { node: Element; level: number }[] = []

    const collect = (node: HastRoot | Element) => {
      for (const child of node.children) {
        if (child.type !== "element") continue

        const level = headingLevel(child.tagName)
        if (level) headings.push({ node: child, level })

        collect(child)
      }
    }

    collect(tree)
    if (headings.length === 0) return

    const shallowest = Math.min(...headings.map((heading) => heading.level))
    const shift = Math.max(0, 2 - shallowest)
    if (shift === 0) return

    // `h6` has nowhere to go. A document nested that deeply has a structural
    // problem this cannot fix, so it is clamped rather than invented.
    for (const heading of headings) {
      heading.node.tagName = `h${Math.min(heading.level + shift, 6)}`
    }
  }
}

/** The text of a hast subtree, flattened. */
function textOf(node: Element | HastRoot): string {
  return node.children
    .map((child) => {
      if (child.type === "text") return child.value
      if (child.type === "element") return textOf(child)
      return ""
    })
    .join("")
    .trim()
}

/**
 * Name the checkboxes a task list generates.
 *
 * Tiptap renders a task item as `<li><label><input><span/></label><div>text</div></li>`
 * - the `<label>` wraps the input but holds no text, and the text sits in a
 * sibling. So the control has no accessible name, which axe reports at `critical`.
 * The item's own text is the label; this states that explicitly.
 *
 * Not `aria-hidden`: the box carries whether the item is done, which is the only
 * thing a task list is for.
 */
function rehypeLabelTaskLists() {
  return (tree: HastRoot) => {
    const findCheckbox = (node: Element): Element | null => {
      for (const child of node.children) {
        if (child.type !== "element") continue
        if (child.tagName === "input" && child.properties.type === "checkbox") return child

        const nested = findCheckbox(child)
        if (nested) return nested
      }

      return null
    }

    const walk = (node: HastRoot | Element) => {
      for (const child of node.children) {
        if (child.type !== "element") continue

        if (child.tagName === "li") {
          const box = findCheckbox(child)
          const label = textOf(child)
          if (box && label) box.properties["aria-label"] = label
        }

        walk(child)
      }
    }

    walk(tree)
  }
}

/**
 * Collect the headings a table of contents is built from.
 *
 * Done as a plugin rather than by re-parsing the finished HTML, because the tree
 * is already here and `rehype-slug` has already assigned the ids the links need.
 * Levels 2 and 3 only: level 4 is detail an author wants in the body, not a fourth
 * tier of navigation, and the editor offers nothing deeper.
 */
function rehypeCollectHeadings(into: TocEntry[]) {
  return (tree: HastRoot) => {
    const walk = (node: HastRoot | Element) => {
      for (const child of node.children) {
        if (child.type !== "element") continue

        const level = child.tagName === "h2" ? 2 : child.tagName === "h3" ? 3 : null
        const id = child.properties.id

        if (level && typeof id === "string") {
          const text = textOf(child)
          if (text) into.push({ id, text, level })
        }

        walk(child)
      }
    }

    walk(tree)
  }
}

/**
 * Send off-site links to a new tab, safely.
 *
 * The sanitiser allows neither `rel` nor `target` on an anchor, so whatever the
 * stored document claims for them is already gone by the time this runs - which is
 * the point. Setting them here means the values are ours rather than the
 * document's, so a `target="_blank"` can never arrive without the `rel` that stops
 * the opened page reaching back through `window.opener`.
 *
 * Same-site links are left alone: a link that stays on the site should stay in the
 * tab, which is the same rule `components/ui/section-header.tsx` follows.
 */
function rehypeExternalLinks() {
  return (tree: HastRoot) => {
    const walk = (node: HastRoot | Element) => {
      for (const child of node.children) {
        if (child.type !== "element") continue

        if (child.tagName === "a") {
          const href = child.properties.href
          if (
            typeof href === "string" &&
            /^https?:\/\//i.test(href) &&
            !href.startsWith(SITE_URL)
          ) {
            child.properties.target = "_blank"
            child.properties.rel = ["noopener", "noreferrer"]
          }
        }

        walk(child)
      }
    }

    walk(tree)
  }
}

/**
 * Make every pane that scrolls sideways reachable and nameable.
 *
 * Two kinds of content in an article are wider than a phone: code blocks and
 * tables. Both have to scroll inside their own box, or they push the whole page
 * sideways - and both have to be focusable and named, or the part that is
 * off-screen is stranded for anyone not using a pointer (PRD US-1.2).
 *
 * `rehype-pretty-code` already makes each `<pre>` focusable, so that one only
 * needs a name. Tailwind Typography gives tables no container at all, so they get
 * one here. Either way this is the rule `components/ui/card.tsx` already applies
 * to its scroll panes: a region only once it actually has a label, because an
 * anonymous region is noise.
 */
function rehypeScrollRegions() {
  return (tree: HastRoot) => {
    let tableCount = 0

    const walk = (node: HastRoot | Element) => {
      node.children = node.children.map((child) => {
        if (child.type !== "element") return child

        if (child.tagName === "pre" && child.properties.tabIndex !== undefined) {
          // `rehype-pretty-code` sets the attribute literally rather than under
          // hast's camelCase key, so both spellings have to be looked for.
          const language = child.properties.dataLanguage ?? child.properties["data-language"]
          child.properties.role = "region"
          child.properties["aria-label"] =
            typeof language === "string" && language.length > 0
              ? `Code sample, ${language}`
              : "Code sample"

          return child
        }

        if (child.tagName === "table") {
          tableCount += 1

          // Numbered, because a page with three tables in it would otherwise
          // offer a screen reader three panes with the same name.
          return {
            type: "element" as const,
            tagName: "div",
            properties: {
              className: ["prose-scroll"],
              tabIndex: 0,
              role: "region",
              "aria-label": `Table ${tableCount}`,
            },
            children: [child],
          }
        }

        walk(child)

        return child
      })
    }

    walk(tree)
  }
}

/**
 * What is allowed to survive into the page.
 *
 * hast-util-sanitize's default schema with exactly one change, and the smallness
 * of that change is the point.
 *
 * The default was inspected rather than assumed: it drops `<script>` and every
 * event handler, restricts `href` to `http`, `https`, `mailto`, `irc`, `ircs` and
 * `xmpp` - so `javascript:` is removed, not merely escaped - clobber-prefixes any
 * `id` it finds, allows disabled checkboxes for task lists, and allows
 * `class="language-*"` on `code`, which is what carries the language through to
 * the highlighter.
 *
 * Notably it does NOT allow `style`, `rel` or `target`, which is why the table
 * widths the editor stores are dropped and why `rehypeExternalLinks` sets link
 * attributes itself rather than trusting the ones in the document.
 *
 * Widening this is a security decision: if a future construct needs an attribute
 * the schema withholds, add that one attribute with a comment saying which
 * construct needs it - do not swap in a permissive schema.
 */
const schema: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Task lists. Tiptap marks them with `data-type="taskList"` and nothing else
    // distinguishes them from an ordinary bullet list, so without this the
    // checkbox gets a bullet beside it and its text wraps underneath - each item
    // reading as two. Restricted to that one value on those two elements; the
    // attribute is inert, styling keys off it and no behaviour does.
    ul: [...(defaultSchema.attributes?.ul ?? []), ["dataType", "taskList"] as [string, string]],
    li: [...(defaultSchema.attributes?.li ?? []), ["dataType", "taskItem"] as [string, string]],
  },
  protocols: {
    ...defaultSchema.protocols,
    // The default allows `http:` here. An article is served over HTTPS, so a plain
    // `http:` image is mixed content the browser blocks anyway - and advertising it
    // is worse than not rendering it.
    //
    // Third-party https hosts are still allowed, which is a deliberate, narrow
    // exposure: an embedded image tells its host the reader's IP and user agent.
    // That is the same trade GitHub and every markdown host makes, and the author
    // is the only person who can write one. `NEXT_PUBLIC_MEDIA_ORIGIN` governs
    // cover images, which are structured data rather than authored prose - see
    // `lib/utils/media.ts`.
    src: ["https"],
  },
}

/**
 * A stored document to sanitised, highlighted HTML.
 *
 * The order is the whole security argument, so it is worth stating plainly. The
 * renderer emits attributes straight out of the stored JSON without judging them -
 * a document carrying `src="javascript:alert(1)"` produces exactly that, which was
 * confirmed by rendering one. So the sanitiser is not a formality here; it is the
 * only thing standing between the database and the reader (threat T-2).
 *
 * It runs on the tree parsed from that output, and everything after it is
 * generated by this pipeline rather than by an author. Running the highlighter
 * first and sanitising afterwards would strip the very attributes Shiki needs;
 * running it this way keeps untrusted input constrained while leaving our own
 * output alone.
 *
 * Sanitising happens at render rather than only on save. Stored content can
 * predate any schema change, so the check that matters is the last one.
 *
 * This runs on the server only. `renderToHTMLString` is Tiptap's DOM-free renderer
 * - chosen over `@tiptap/html`, which needs a `happy-dom` peer that a Cloudflare
 * Workers isolate has no way to provide - and neither it nor the highlighter ever
 * reaches a client bundle (NFR-5).
 */
export async function renderDocument(document: PostDocument): Promise<RenderedArticle> {
  const html = renderToHTMLString({ content: document, extensions: BLOG_EXTENSIONS })
  const headings: TocEntry[] = []

  const file = await unified()
    // A fragment: this is article body, not a whole document, so no <html> or
    // <body> should be invented around it.
    .use(rehypeParse, { fragment: true })
    .use(rehypeNormaliseHeadings)
    .use(rehypeSanitize, schema)
    // Namespaced for the same reason footnote ids are: a heading slugging to
    // `document`, `posthog` or `__next` is a DOM-clobbering surface, and the
    // sanitiser cannot help because it runs before this does.
    .use(rehypeSlug, { prefix: "user-content-" })
    .use(rehypeLabelTaskLists)
    .use(rehypeExternalLinks)
    .use(rehypeCollectHeadings, headings)
    .use(rehypePrettyCode, {
      theme: CODE_THEMES,
      // Keeps the wrapper's own background off, so the block inherits the
      // component token defined in globals.css and matches the card it sits in.
      keepBackground: false,
    })
    .use(rehypeScrollRegions)
    .use(rehypeStringify)
    .process(html)

  return { html: String(file), headings }
}

/** Every text node in a stored document, in order. */
function documentText(node: PostDocument): string {
  const parts: string[] = []

  const walk = (current: PostDocument) => {
    if (typeof current.text === "string") parts.push(current.text)
    for (const child of current.content ?? []) walk(child)
  }

  walk(node)

  return parts.join(" ").replace(/\s+/g, " ").trim()
}

/**
 * The plain text of a document, for reading time and for an excerpt.
 *
 * Taken from the JSON rather than from the rendered HTML: the rendering is
 * expensive, and everything that would need stripping out of it - markup,
 * highlighting spans, the generated footnote section - is absent here to begin
 * with.
 */
export const plainText = documentText

/**
 * A plain-text excerpt, for a post that has not been given one.
 *
 * Feeds meta descriptions and feed summaries, so it is cut on a word boundary
 * rather than mid-word.
 */
export function deriveExcerpt(document: PostDocument, maxLength = 160): string {
  const plain = documentText(document)

  if (plain.length <= maxLength) return plain

  const cut = plain.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(" ")

  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`
}
