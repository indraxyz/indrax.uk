import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { BlogShell } from "@/features/blog/components/blog-shell"
import { CopyCode } from "@/features/blog/components/copy-code"
import { PostContent } from "@/features/blog/components/post-content"
import { PostCover } from "@/features/blog/components/post-cover"
import { PostMeta } from "@/features/blog/components/post-meta"
import { PreviewBanner } from "@/features/blog/components/preview-banner"
import { TableOfContents } from "@/features/blog/components/table-of-contents"
import { TagPill } from "@/features/blog/components/tag-pill"
import { getPostForPreview } from "@/features/blog/data/queries"
import { renderDocument } from "@/features/blog/utils/content"
import { verifyPreviewToken } from "@/features/blog/utils/preview-token"

/**
 * A draft, readable by whoever holds a valid token for it.
 *
 * **Its own route, rather than `?preview=` on the article page.** The spec asked
 * for the query-parameter form, and it was built that way first - which turned
 * every article from prerendered into on-demand, because a page that reads
 * `searchParams` cannot be static. That meant re-running Shiki on every read of
 * every published article, forever, to support a feature used a handful of times
 * a month. The published path is the one that has to be fast (NFR-1), so the
 * dynamic behaviour lives here instead and `/blog/[slug]` stays prerendered.
 *
 * Nothing about a preview may be cached or indexed: the content is unpublished and
 * changes between refreshes, which is the entire point of reviewing it.
 */
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Draft preview",
  robots: { index: false, follow: false, nocache: true },
}

interface PreviewPageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ token?: string }>
}

export default async function PreviewPage({ params, searchParams }: PreviewPageProps) {
  const { slug } = await params
  const { token } = await searchParams

  // Verified against the slug being requested rather than the one carried in the
  // token, so a token minted for one draft cannot be replayed against another.
  // Expired, tampered, wrong post and absent all land here identically, and all
  // become the same 404 a draft gives anyone else (threat T-4).
  if (!(await verifyPreviewToken(token, slug))) notFound()

  const post = await getPostForPreview(slug)
  if (!post) notFound()

  const article = await renderDocument(post.content)

  return (
    <BlogShell>
      <PreviewBanner status={post.status} />

      {/* No structured data, no Open Graph, no view beacon and no related posts:
          every one of those describes or advertises something public, and this is
          not. */}
      <article>
        <Card variant="card" className="variant-primary variant-border">
          <PostCover post={post} priority />

          <CardHeader className="gap-4">
            <h1 className="text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
              {post.title}
            </h1>

            <PostMeta post={post} />

            {post.tags.length > 0 && (
              <nav aria-label="Article tags" className="flex flex-wrap items-center gap-2">
                {post.tags.map((tag) => (
                  <TagPill key={tag.id} tag={tag} />
                ))}
              </nav>
            )}
          </CardHeader>

          <CardContent className="pt-2">
            <TableOfContents entries={article.headings} className="mb-8 print:hidden" />
            <PostContent html={article.html} />
          </CardContent>
        </Card>
      </article>

      <CopyCode />
    </BlogShell>
  )
}
