import { Newspaper } from "lucide-react"
import type { ReactNode } from "react"

import { SectionCard } from "@/components/ui/section-card"
import { Pagination } from "@/features/blog/components/pagination"
import { PostCard } from "@/features/blog/components/post-card"
import type { PaginatedPosts } from "@/features/blog/types"

interface PostListSectionProps {
  title: string
  subtitle: string
  results: PaginatedPosts
  basePath: string
  emptyState: ReactNode
  /** Passed through to `Pagination`; see the note on its own props. */
  previousLabel?: string
  nextLabel?: string
  /** Rendered above the list, for the search box. */
  children?: ReactNode
}

/**
 * The list of posts, framed the same way every section on this site is framed.
 *
 * Composed from `SectionCard` rather than styled fresh, so the blog inherits the
 * card, the header bar and the scroll-region semantics the resume sections
 * already have - and stays in step with them when they change.
 */
export function PostListSection({
  title,
  subtitle,
  results,
  basePath,
  emptyState,
  previousLabel,
  nextLabel,
  children,
}: PostListSectionProps) {
  return (
    <SectionCard
      variant="ghost"
      icon={<Newspaper className="h-5 w-5" />}
      title={title}
      subtitle={subtitle}
      // These routes have no hero above them, so this header is the page's only
      // top-level heading. Without it the page has no h1 at all, which axe reports
      // and which leaves heading navigation with no entry point.
      headingLevel={1}
    >
      {children}

      {results.posts.length === 0 ? (
        emptyState
      ) : (
        <div className="space-y-8">
          <div className="grid gap-6 md:grid-cols-2">
            {results.posts.map((post, index) => (
              // The first card is the largest thing above the fold on this page,
              // so its cover - when there is one - is what LCP is measured on.
              <PostCard key={post.id} post={post} priority={index === 0} />
            ))}
          </div>

          <Pagination
            page={results.page}
            pageCount={results.pageCount}
            basePath={basePath}
            label={`${title} pages`}
            previousLabel={previousLabel}
            nextLabel={nextLabel}
          />
        </div>
      )}
    </SectionCard>
  )
}
