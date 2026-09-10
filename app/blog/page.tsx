import type { Metadata } from "next"

import { EmptyState } from "@/features/blog/components/empty-state"
import { PostListSection } from "@/features/blog/components/post-list-section"
import { TagPill } from "@/features/blog/components/tag-pill"
import { BLOG_CONFIG, EMPTY_COPY, SECTION_COPY } from "@/features/blog/config"
import { getPublishedPosts, getTagsInUse } from "@/features/blog/data/queries"
import { parsePageParam } from "@/features/blog/utils/page-param"
import { BlogShell } from "@/features/blog/components/blog-shell"
import { personalInfo } from "@/features/resume/data/resume"

interface BlogPageProps {
  searchParams: Promise<{ page?: string }>
}

/**
 * Each page of the archive canonicalises to itself.
 *
 * Pointing page two at page one tells a crawler it is a duplicate, and the posts
 * on it are then never indexed - which would quietly undo the whole reason the
 * pagination is built from real `<a href>` links (PRD US-2.1).
 */
export async function generateMetadata({ searchParams }: BlogPageProps): Promise<Metadata> {
  const { page } = await searchParams
  const current = parsePageParam(page)
  const path = current > 1 ? `${BLOG_CONFIG.basePath}?page=${current}` : BLOG_CONFIG.basePath
  const title =
    current > 1
      ? `${BLOG_CONFIG.title} - page ${current} - ${personalInfo.name}`
      : `${BLOG_CONFIG.title} - ${personalInfo.name}`

  return {
    title,
    description: BLOG_CONFIG.feedDescription,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      title,
      description: BLOG_CONFIG.feedDescription,
    },
  }
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const { page } = await searchParams

  const [results, tags] = await Promise.all([
    getPublishedPosts(parsePageParam(page)),
    getTagsInUse(),
  ])

  return (
    <BlogShell>
      {tags.length > 0 && (
        <nav aria-label="Tags" className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <TagPill key={tag.id} tag={tag} count={tag.postCount} />
          ))}
        </nav>
      )}

      <PostListSection
        title={BLOG_CONFIG.title}
        subtitle={SECTION_COPY.blog}
        results={results}
        basePath={BLOG_CONFIG.basePath}
        emptyState={<EmptyState message={EMPTY_COPY.blog} />}
      />
    </BlogShell>
  )
}
