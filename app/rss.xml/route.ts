import { BLOG_CONFIG } from "@/features/blog/config"
import { getFeedPosts } from "@/features/blog/data/queries"
import { absoluteUrl } from "@/features/resume/config"
import { personalInfo } from "@/features/resume/data/resume"

// The feed is a pure function of published posts, so it is cached like the pages
// are and rebuilt when the `posts` tag is invalidated.
export const revalidate = 3600

/**
 * Escape text for XML.
 *
 * A feed is XML, not HTML, and an unescaped `&` or `<` in a title is not a
 * rendering glitch - it makes the whole document ill-formed, and a reader that
 * cannot parse it shows nothing at all rather than one broken item.
 */
const escape = (value: string) =>
  value
    // XML 1.0 forbids these outright, so one of them in a title does not produce a
    // mangled entry - it makes the whole document ill-formed and the reader shows
    // nothing at all. Stripped before escaping, since escaping cannot rescue them.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")

export async function GET() {
  const posts = await getFeedPosts()

  // `email` is optional on the resume type, and RSS's managingEditor is an email
  // address with an optional name - a bare name is not a valid value, so the
  // element is omitted rather than emitted malformed.
  const editor = personalInfo.email
    ? `    <managingEditor>${escape(`${personalInfo.email} (${personalInfo.name})`)}</managingEditor>\n`
    : ""
  const updated = posts[0]?.publishedAt ?? new Date().toISOString()

  const items = posts
    .map((post) => {
      const url = absoluteUrl(`${BLOG_CONFIG.basePath}/${post.slug}`)

      return `    <item>
      <title>${escape(post.title)}</title>
      <link>${escape(url)}</link>
      <guid isPermaLink="true">${escape(url)}</guid>
      ${post.publishedAt ? `<pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>` : ""}
      <description>${escape(post.excerpt ?? "")}</description>
${post.tags.map((tag) => `      <category>${escape(tag.name)}</category>`).join("\n")}
    </item>`
    })
    .join("\n")

  // Absolute URLs throughout: a feed is read somewhere other than this origin, so
  // a relative link in it points at whatever the reader happens to be.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(BLOG_CONFIG.feedTitle)}</title>
    <link>${escape(absoluteUrl(BLOG_CONFIG.basePath))}</link>
    <description>${escape(BLOG_CONFIG.feedDescription)}</description>
    <language>en</language>
${editor}    <lastBuildDate>${new Date(updated).toUTCString()}</lastBuildDate>
    <atom:link href="${escape(absoluteUrl(BLOG_CONFIG.feedPath))}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
