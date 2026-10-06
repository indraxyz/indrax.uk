import { WRITING_CONFIG } from "@/features/writing/config"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ArticleCard } from "@/features/writing/components/article-card"
import { WritingShell } from "@/features/writing/components/writing-shell"
import { CopyCode } from "@/features/writing/components/copy-code"
import { PreviewBanner } from "@/features/writing/components/preview-banner"
import { getPostForPreview } from "@/features/writing/data/queries"
import { renderDocument } from "@/features/writing/utils/content"
import { verifyPreviewToken } from "@/features/writing/utils/preview-token"

/**
 * A draft, readable by whoever holds a valid token for it.
 *
 * **Its own route, rather than `?preview=` on the article page.** The spec asked
 * for the query-parameter form, and it was built that way first - which turned
 * every article from prerendered into on-demand, because a page that reads
 * `searchParams` cannot be static. That meant re-running Shiki on every read of
 * every published article, forever, to support a feature used a handful of times
 * a month. The published path is the one that has to be fast (NFR-1), so the
 * dynamic behaviour lives here instead and `/writing/[slug]` stays prerendered.
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
    <WritingShell
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: WRITING_CONFIG.title, path: WRITING_CONFIG.basePath },
        { name: `Preview: ${post.title}` },
      ]}
    >
      <PreviewBanner status={post.status} />

      {/* No structured data, no Open Graph, no view beacon and no related posts:
          every one of those describes or advertises something public, and this is
          not. */}
      <ArticleCard post={post} article={article} />

      <CopyCode />
    </WritingShell>
  )
}
