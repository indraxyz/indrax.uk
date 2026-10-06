import type { Metadata } from "next"

import { EmptyState } from "@/features/writing/components/empty-state"
import { PostListSection } from "@/features/writing/components/post-list-section"
import { SearchForm } from "@/features/writing/components/search-form"
import { TagPill } from "@/features/writing/components/tag-pill"
import { WRITING_CONFIG, EMPTY_COPY, SECTION_COPY } from "@/features/writing/config"
import { getPublishedPosts, getTagsInUse } from "@/features/writing/data/queries"
import { parsePageParam } from "@/features/writing/utils/page-param"
import { WritingShell } from "@/features/writing/components/writing-shell"
import { personalInfo } from "@/features/resume/data/resume"

interface WritingPageProps {
  searchParams: Promise<{ page?: string }>
}

/**
 * Each page of the archive canonicalises to itself.
 *
 * Pointing page two at page one tells a crawler it is a duplicate, and the posts
 * on it are then never indexed - which would quietly undo the whole reason the
 * pagination is built from real `<a href>` links (PRD US-2.1).
 */
export async function generateMetadata({ searchParams }: WritingPageProps): Promise<Metadata> {
  const { page } = await searchParams
  const current = parsePageParam(page)
  const path = current > 1 ? `${WRITING_CONFIG.basePath}?page=${current}` : WRITING_CONFIG.basePath
  const title =
    current > 1
      ? `${WRITING_CONFIG.title} - page ${current} - ${personalInfo.name}`
      : `${WRITING_CONFIG.title} - ${personalInfo.name}`

  return {
    title,
    description: WRITING_CONFIG.feedDescription,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      title,
      description: WRITING_CONFIG.feedDescription,
    },
  }
}

export default async function WritingPage({ searchParams }: WritingPageProps) {
  const { page } = await searchParams

  const [results, tags] = await Promise.all([
    getPublishedPosts(parsePageParam(page)),
    getTagsInUse(),
  ])

  return (
    <WritingShell>
      <PostListSection
        title={WRITING_CONFIG.title}
        subtitle={SECTION_COPY.writing}
        results={results}
        basePath={WRITING_CONFIG.basePath}
        emptyState={<EmptyState message={EMPTY_COPY.writing} />}
      >
        {/* A GET form, so this is a link to `/writing/search?q=...` by another name -
            it works with no JavaScript, and the result it reaches is a URL
            somebody can share. */}
        <div className="space-y-4 pb-2">
          <SearchForm query="" />
          {tags.length > 0 && (
            <nav aria-label="Tags" className="flex flex-wrap items-center gap-2">
              {tags.map((tag) => (
                <TagPill key={tag.id} tag={tag} count={tag.postCount} />
              ))}
            </nav>
          )}
        </div>
      </PostListSection>
    </WritingShell>
  )
}
