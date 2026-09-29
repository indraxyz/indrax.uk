import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BlogShell } from "@/features/blog/components/blog-shell"
import { EmptyState } from "@/features/blog/components/empty-state"
import { PostListSection } from "@/features/blog/components/post-list-section"
import { BLOG_CONFIG, EMPTY_COPY, tagSubtitle } from "@/features/blog/config"
import { getPostsByTag, getTagsInUse } from "@/features/blog/data/queries"
import { parsePageParam } from "@/features/blog/utils/page-param"
import { buildBreadcrumbStructuredData } from "@/features/blog/utils/structured-data"
import { serialiseJsonLd } from "@/lib/utils"

interface TagPageProps {
  params: Promise<{ tag: string }>
  searchParams: Promise<{ page?: string }>
}

const pathFor = (slug: string) => `${BLOG_CONFIG.basePath}/tag/${slug}`

/**
 * Only tags that carry a published post.
 *
 * `getTagsInUse` joins through to published posts, so a tag whose every article
 * is still a draft has no page here and no entry in the sitemap - which is the
 * same thing as saying it 404s (PRD US-2.2).
 */
async function findTag(slug: string) {
  const tags = await getTagsInUse()

  return tags.find((tag) => tag.slug === slug) ?? null
}

export async function generateStaticParams() {
  const tags = await getTagsInUse()

  return tags.map((tag) => ({ tag: tag.slug }))
}

export async function generateMetadata({ params, searchParams }: TagPageProps): Promise<Metadata> {
  const { tag: slug } = await params
  const tag = await findTag(slug)

  if (!tag) return { title: "Not found", robots: { index: false, follow: false } }

  const current = parsePageParam((await searchParams).page)
  const path = current > 1 ? `${pathFor(tag.slug)}?page=${current}` : pathFor(tag.slug)
  const title =
    current > 1
      ? `${tag.name} - page ${current} - ${BLOG_CONFIG.title}`
      : `${tag.name} - ${BLOG_CONFIG.title}`
  const description = tagSubtitle(tag.name)

  return {
    title,
    description,
    // Declared, self-referencing, and indexable: a tag page with published posts
    // on it is a real entry point, not a duplicate of the list (PRD US-2.2).
    alternates: { canonical: path },
    robots: { index: true, follow: true },
    openGraph: { type: "website", url: path, title, description },
  }
}

export default async function TagPage({ params, searchParams }: TagPageProps) {
  const { tag: slug } = await params
  const { page } = await searchParams

  const tag = await findTag(slug)
  if (!tag) notFound()

  const results = await getPostsByTag(tag.slug, parsePageParam(page))

  const breadcrumbs = buildBreadcrumbStructuredData([
    { name: "Home", path: "/" },
    { name: BLOG_CONFIG.title, path: BLOG_CONFIG.basePath },
    { name: tag.name, path: pathFor(tag.slug) },
  ])

  return (
    <BlogShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serialiseJsonLd(breadcrumbs) }}
      />

      <PostListSection
        title={tag.name}
        subtitle={tagSubtitle(tag.name)}
        results={results}
        basePath={pathFor(tag.slug)}
        emptyState={<EmptyState message={EMPTY_COPY.tag(tag.name)} />}
      />
    </BlogShell>
  )
}
