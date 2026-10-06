import { Eye } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ArticleCard } from "@/features/writing/components/article-card"
import { WritingShell } from "@/features/writing/components/writing-shell"
import { CopyCode } from "@/features/writing/components/copy-code"
import { RelatedPosts } from "@/features/writing/components/related-posts"
import { ViewBeacon } from "@/features/writing/components/view-beacon"
import { WRITING_CONFIG } from "@/features/writing/config"
import { getPostBySlug, getPublishedSlugs, getRelatedPosts } from "@/features/writing/data/queries"
import { renderDocument } from "@/features/writing/utils/content"
import {
  buildArticleStructuredData,
  buildBreadcrumbStructuredData,
} from "@/features/writing/utils/structured-data"
import { personalInfo } from "@/features/resume/data/resume"
import { serialiseJsonLd } from "@/lib/utils"

interface ArticlePageProps {
  params: Promise<{ slug: string }>
}

/**
 * Prerender what exists at build time.
 *
 * Anything published afterwards is rendered on demand and then cached under the
 * `posts` tag, so a new article does not wait for a deploy. When there is no
 * database configured this returns nothing, which is exactly right: there is
 * nothing to prerender, and the build still succeeds.
 */
export async function generateStaticParams() {
  const slugs = await getPublishedSlugs()

  return slugs.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  // A draft, an archived post and a slug that never existed all produce the same
  // metadata for the same reason they produce the same status code: the response
  // must not confirm that the row is there (threat T-4).
  if (!post) return { title: "Not found", robots: { index: false, follow: false } }

  const path = `${WRITING_CONFIG.basePath}/${post.slug}`
  const description = post.excerpt ?? WRITING_CONFIG.feedDescription

  return {
    title: post.title,
    description,
    alternates: { canonical: path },
    authors: [{ name: personalInfo.name }],
    openGraph: {
      type: "article",
      url: path,
      title: post.title,
      description,
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      authors: [personalInfo.name],
      tags: post.tags.map((tag) => tag.name),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
    },
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params
  const post = await getPostBySlug(slug)

  if (!post) notFound()

  // One render pass. It produces both the body and the headings the contents list
  // is built from, so doing it twice would be paying twice for one answer.
  const [article, related] = await Promise.all([
    renderDocument(post.content),
    getRelatedPosts(post.id),
  ])

  const breadcrumbTrail = [
    { name: "Home", path: "/" },
    { name: WRITING_CONFIG.title, path: WRITING_CONFIG.basePath },
    { name: post.title, path: `${WRITING_CONFIG.basePath}/${post.slug}` },
  ]
  const structuredData = [
    buildArticleStructuredData(post),
    buildBreadcrumbStructuredData(breadcrumbTrail),
  ]

  return (
    <WritingShell breadcrumbs={breadcrumbTrail}>
      {structuredData.map((data) => (
        <script
          key={data["@type"]}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serialiseJsonLd(data) }}
        />
      ))}

      <ArticleCard
        post={post}
        article={article}
        meta={
          post.viewCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
              <Eye className="h-3.5 w-3.5" aria-hidden />
              {post.viewCount.toLocaleString("en-US")} views
            </span>
          )
        }
      />

      <RelatedPosts posts={related} />

      {/* Both are decoration, and both are additive: the article above is complete
          without either. The counter is an image so it works with JavaScript off;
          the copy buttons are the one thing on this page that needs a script, and
          they are attached only after the page has already rendered. */}
      <ViewBeacon slug={post.slug} />
      <CopyCode />
    </WritingShell>
  )
}
