import rehypePrettyCode from "rehype-pretty-code"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import rehypeSlug from "rehype-slug"
import rehypeStringify from "rehype-stringify"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"

import type { Heading, Nodes, Root } from "mdast"
import type { Element, Root as HastRoot } from "hast"

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

/**
 * Normalise authored headings so the shallowest one becomes an `<h2>`.
 *
 * The article's own `<h1>` is the post title, rendered by the route, so nothing in
 * the body may be an `h1` - two of them is both a validity error and a real
 * problem for anyone navigating by heading. But a blanket demotion is not the
 * answer either: it turns a post written with `##` into `h3`, and `h1` to `h3`
 * skips a level, which is the other half of the same acceptance criterion
 * (PRD US-1.1).
 *
 * So the shift is computed from the document rather than fixed. A post written
 * with `#` at the top level shifts down by one; a post already written with `##`
 * is left exactly as it is. Either way the first heading a reader meets is an
 * `h2` under the title, and the relative structure the author intended survives.
 */
function remarkNormaliseHeadings() {
  return (tree: Root) => {
    const headings: Heading[] = []

    const collect = (node: Nodes) => {
      if (node.type === "heading") headings.push(node)
      if ("children" in node) node.children.forEach(collect)
    }

    collect(tree)
    if (headings.length === 0) return

    const shallowest = Math.min(...headings.map((heading) => heading.depth))
    const shift = Math.max(0, 2 - shallowest)
    if (shift === 0) return

    // `h6` has nowhere to go. A document nested that deeply has a structural
    // problem this cannot fix, so it is clamped rather than invented - and the
    // depth type only admits 1-6, which is what makes the clamp checkable.
    const DEPTHS: Heading["depth"][] = [1, 2, 3, 4, 5, 6]

    for (const heading of headings) {
      heading.depth = DEPTHS[Math.min(heading.depth + shift, 6) - 1]
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
 * Name the checkboxes GFM task lists generate.
 *
 * `remark-gfm` renders `- [x] Done` as a disabled `<input type="checkbox">`
 * followed by loose text, with nothing tying the two together - so axe reports it
 * as a form control with no label, at `critical`. The item's own text is the
 * label; this states that explicitly rather than leaving a screen reader to
 * announce an anonymous checkbox.
 *
 * Not `aria-hidden`: the box carries whether the item is done, which is the only
 * thing a task list is for.
 */
function rehypeLabelTaskLists() {
  return (tree: HastRoot) => {
    const walk = (node: HastRoot | Element) => {
      for (const child of node.children) {
        if (child.type !== "element") continue

        if (child.tagName === "li") {
          const box = child.children.find(
            (item) =>
              item.type === "element" &&
              item.tagName === "input" &&
              item.properties.type === "checkbox"
          )

          if (box && box.type === "element") {
            const label = textOf(child)
            if (label) box.properties["aria-label"] = label
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
 * of that change is the point. The default was inspected rather than assumed: it
 * drops `<script>` and every event handler, restricts `href` to `http`, `https`,
 * `mailto`, `irc`, `ircs` and `xmpp` - so `javascript:` is removed, not merely
 * escaped - and already knows about the GFM constructs `remark-gfm` emits:
 * footnote sections and backrefs, disabled task-list checkboxes, and
 * `class="language-*"` on `code`, which is what carries the language through to
 * the highlighter.
 *
 * Two changes, both below. Widening this is a security decision: if a future
 * construct needs an attribute the schema withholds, add that one attribute with a
 * comment saying which construct needs it - do not swap in a permissive schema.
 */
const schema = {
  ...defaultSchema,
  // `remark-rehype` has already prefixed the ids it generates for GFM footnotes,
  // and it prefixed the hrefs pointing at them to match. Letting the sanitiser
  // prefix a second time renames the targets but not the links, which silently
  // breaks every footnote anchor in the document. Verified by rendering one.
  //
  // Note this does NOT mean ids are unprefixed: `rehype-slug` runs after the
  // sanitiser and so was never governed by this setting either way, which is why
  // it is given its own `user-content-` prefix below.
  clobberPrefix: "",
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
 * Markdown source to sanitised, highlighted HTML.
 *
 * The order is the whole security argument, so it is worth stating plainly.
 * Sanitising runs on the tree parsed from the author's markdown, and everything
 * after it is generated by this pipeline rather than by a human. Running the
 * highlighter first and sanitising afterwards would strip the very attributes
 * Shiki needs; running it this way keeps untrusted input constrained while
 * leaving our own output alone.
 *
 * Sanitising happens here, at render, rather than only on save (threat T-2).
 * Stored content can predate any schema change, so the check that matters is the
 * one standing between the database and the reader.
 *
 * This runs on the server only - it is called from server components, and the
 * highlighter never reaches a client bundle (NFR-5).
 */
export async function renderMarkdown(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkNormaliseHeadings)
    // `allowDangerousHtml` stays off: raw HTML in the source is dropped at the
    // boundary rather than carried through to be sanitised later.
    .use(remarkRehype)
    .use(rehypeSanitize, schema)
    // Namespaced for the same reason `remark-rehype` namespaces footnote ids: a
    // heading slugging to `document`, `posthog` or `__next` is a DOM-clobbering
    // surface, and the sanitiser cannot help here because it runs before this does.
    .use(rehypeSlug, { prefix: "user-content-" })
    .use(rehypeLabelTaskLists)
    .use(rehypePrettyCode, {
      theme: CODE_THEMES,
      // Keeps the wrapper's own background off, so the block inherits the
      // component token defined in globals.css and matches the card it sits in.
      keepBackground: false,
    })
    .use(rehypeScrollRegions)
    .use(rehypeStringify)
    .process(markdown)

  return String(file)
}

/**
 * A plain-text excerpt, for a post that has not been given one.
 *
 * Strips markdown syntax rather than rendering and un-rendering it - this feeds
 * meta descriptions and feed summaries, where a stray backtick is worse than an
 * imperfect truncation.
 */
export function deriveExcerpt(markdown: string, maxLength = 160): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    // Raw HTML never reaches the page, so it must not reach a meta description
    // or a feed summary either.
    .replace(/<[^>]*>/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim()

  if (plain.length <= maxLength) return plain

  // Cut on a word boundary so the ellipsis does not land mid-word.
  const cut = plain.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(" ")

  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`
}
