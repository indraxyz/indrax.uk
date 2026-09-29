import { redirect } from "next/navigation"

import { getPostBySlug } from "@/features/blog/data/queries"
import { POST_CARD_CONTENT_TYPE, POST_CARD_SIZE, renderPostCard } from "@/features/blog/social-card"
import { logServerError } from "@/lib/observability"

// The filename is a Next.js metadata convention, not a description: this route is
// what populates `og:image` for one article, and Next derives `twitter:image` from
// it too. The card itself is named for what it is, in
// `features/blog/social-card.tsx`.
export const alt = "Article banner"
export const size = POST_CARD_SIZE
export const contentType = POST_CARD_CONTENT_TYPE

interface OpengraphImageProps {
  // Async, like every other route segment's params in Next 16. Typing it as a
  // plain object compiles and then silently yields `undefined` for `slug`, which
  // looks exactly like a post that does not exist - so every card quietly became
  // the fallback. Caught by requesting one.
  params: Promise<{ slug: string }>
}

export default async function OpengraphImage({ params }: OpengraphImageProps) {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  // A draft has no card for the same reason it has no page. Falling back to the
  // site card rather than erroring means the tag a crawler already fetched still
  // resolves to an image (PRD US-5.3).
  if (!post) redirect("/opengraph-image")

  try {
    return await renderPostCard(post)
  } catch (error) {
    // Drawing this card needs fonts, and fetching them can fail in a way that
    // rendering the article itself does not. A broken image response is worse
    // than a generic one, so the site card stands in.
    logServerError(error, { scope: "blog.opengraphImage", slug })
    redirect("/opengraph-image")
  }
}
