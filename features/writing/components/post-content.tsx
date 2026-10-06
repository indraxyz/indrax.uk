interface PostContentProps {
  html: string
}

/**
 * The article body.
 *
 * A presenter: `renderDocument` runs once in the route, because the same pass
 * that produces this HTML also produces the headings the table of contents needs,
 * and rendering twice to get both would be paying twice for one answer.
 *
 * `dangerouslySetInnerHTML` is the honest interface for a string of HTML, and the
 * danger has already been dealt with: `renderDocument` sanitises against an
 * explicit allow-list at render time, so what arrives here has been through the
 * filter that stands between the database and the reader (threat T-2).
 *
 * Nothing about this is a client component, which is what keeps the editor, the
 * highlighter and the theme out of the browser (NFR-5) and the body readable with
 * JavaScript disabled (PRD US-1.1).
 */
export function PostContent({ html }: PostContentProps) {
  return <div className="prose prose-lg max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}
