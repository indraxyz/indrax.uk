import { renderMarkdown } from "@/features/blog/utils/markdown"

interface PostContentProps {
  content: string
}

/**
 * The article body.
 *
 * A server component, and it has to stay one. Everything expensive - parsing,
 * sanitising, highlighting - happens here during the render, so the reader
 * receives finished HTML and the browser downloads no markdown parser, no
 * highlighter, and no theme (NFR-5). It is also why the body is readable with
 * JavaScript disabled (PRD US-1.1).
 *
 * `dangerouslySetInnerHTML` is the honest interface for a string of HTML, and the
 * danger has already been dealt with: `renderMarkdown` sanitises against an
 * explicit allow-list at render time, so what arrives here has been through the
 * filter that stands between the database and the reader (threat T-2).
 */
export async function PostContent({ content }: PostContentProps) {
  const html = await renderMarkdown(content)

  return <div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}
