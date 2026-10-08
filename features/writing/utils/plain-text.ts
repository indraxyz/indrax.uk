import type { PostDocument } from "@/features/writing/types"

/**
 * The plain text of a document, for reading time and for an excerpt.
 *
 * Taken from the JSON rather than from the rendered HTML: the rendering is
 * expensive, and everything that would need stripping out of it - markup,
 * highlighting spans, the generated footnote section - is absent here to begin
 * with.
 */
export function plainText(node: PostDocument): string {
  const parts: string[] = []

  const walk = (current: PostDocument) => {
    if (typeof current.text === "string") parts.push(current.text)
    for (const child of current.content ?? []) walk(child)
  }

  walk(node)

  return parts.join(" ").replace(/\s+/g, " ").trim()
}

/**
 * A plain-text excerpt, for a post that has not been given one.
 *
 * Feeds meta descriptions and feed summaries, so it is cut on a word boundary
 * rather than mid-word.
 */
export function deriveExcerpt(document: PostDocument, maxLength = 160): string {
  return deriveExcerptText(plainText(document), maxLength)
}

/** Reuse already extracted text when saving a post. */
export function deriveExcerptText(plain: string, maxLength = 160): string {
  if (plain.length <= maxLength) return plain

  const cut = plain.slice(0, maxLength)
  const lastSpace = cut.lastIndexOf(" ")

  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`
}
