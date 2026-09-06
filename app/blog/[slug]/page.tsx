import { Eye } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { BlogShell } from "@/features/blog/components/blog-shell"
import { CopyCode } from "@/features/blog/components/copy-code"
import { PostContent } from "@/features/blog/components/post-content"
import { PostCover } from "@/features/blog/components/post-cover"
import { PostMeta } from "@/features/blog/components/post-meta"
import { RelatedPosts } from "@/features/blog/components/related-posts"
import { TableOfContents } from "@/features/blog/components/table-of-contents"
import { TagPill } from "@/features/blog/components/tag-pill"
import { ViewBeacon } from "@/features/blog/components/view-beacon"
import { BLOG_CONFIG } from "@/features/blog/config"
import { getPostBySlug, getPublishedSlugs, getRelatedPosts } from "@/features/blog/data/queries"
import { renderDocument } from "@/features/blog/utils/content"
import {
  buildArticleStructuredData,
  buildBreadcrumbStructuredData,
} from "@/features/blog/utils/structured-data"
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

  const path = `${BLOG_CONFIG.basePath}/${post.slug}`
  const description = post.excerpt ?? BLOG_CONFIG.feedDescription

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

  const structuredData = [
    buildArticleStructuredData(post),
    buildBreadcrumbStructuredData([
      { name: "Home", path: "/" },
      { name: BLOG_CONFIG.title, path: BLOG_CONFIG.basePath },
      { name: post.title, path: `${BLOG_CONFIG.basePath}/${post.slug}` },
    ]),
  ]

  return (
    <BlogShell>
      {structuredData.map((data, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serialiseJsonLd(data) }}
        />
      ))}

      <article>
        <Card variant="card" className="variant-primary variant-border">
          <PostCover post={post} priority />

          <CardHeader className="gap-4">
            {/* The page's only h1. The render pipeline shifts body headings so the
                shallowest becomes an h2, which keeps this true whatever a post
                contains and without skipping a level. */}
            <h1 className="text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <PostMeta post={post} />
              {post.viewCount > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" aria-hidden />
                  {post.viewCount.toLocaleString("en-US")} views
                </span>
              )}
            </div>

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

      <RelatedPosts posts={related} />

      {/* Both are decoration, and both are additive: the article above is complete
          without either. The counter is an image so it works with JavaScript off;
          the copy buttons are the one thing on this page that needs a script, and
          they are attached only after the page has already rendered. */}
      <ViewBeacon slug={post.slug} />
      <CopyCode />
    </BlogShell>
  )
}
