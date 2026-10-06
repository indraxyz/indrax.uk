import type { Metadata } from "next"

import { WritingShell } from "@/features/writing/components/writing-shell"
import { EmptyState } from "@/features/writing/components/empty-state"
import { PostListSection } from "@/features/writing/components/post-list-section"
import { SearchForm } from "@/features/writing/components/search-form"
import { WRITING_CONFIG, EMPTY_COPY } from "@/features/writing/config"
import { normaliseQuery, searchPosts } from "@/features/writing/data/queries"
import { parsePageParam } from "@/features/writing/utils/page-param"
import { buildBreadcrumbStructuredData } from "@/features/writing/utils/structured-data"
import { serialiseJsonLd } from "@/lib/utils"

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>
}

const TITLE = "Search"

/**
 * Never indexed, and that is the point of the route existing separately.
 *
 * A search page is an infinite URL space: every distinct `?q=` is a new page as
 * far as a crawler is concerned, all of them thin, all of them duplicating
 * content that already has a canonical home on the article itself. Google calls
 * this a crawl trap and it is the usual reason a small site's crawl budget
 * evaporates. `noindex, follow` keeps the results out of the index while still
 * letting a crawler walk through to the articles.
 *
 * It also removes the incentive to point a crawler at expensive queries, since
 * there is nothing to gain by having them indexed (threat T-11).
 */
export const metadata: Metadata = {
  title: `${TITLE} - ${WRITING_CONFIG.title}`,
  description: "Search the archive.",
  robots: { index: false, follow: true },
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q, page } = await searchParams

  // Normalised once here so the heading, the box and the query that runs all
  // agree on what was asked - including when the answer is "that is not a search".
  const query = normaliseQuery(q)
  const results = await searchPosts(query, parsePageParam(page))

  const breadcrumbTrail = [
    { name: "Home", path: "/" },
    { name: WRITING_CONFIG.title, path: WRITING_CONFIG.basePath },
    { name: TITLE, path: WRITING_CONFIG.searchPath },
  ]
  const breadcrumbs = buildBreadcrumbStructuredData(breadcrumbTrail)

  return (
    <WritingShell breadcrumbs={breadcrumbTrail}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serialiseJsonLd(breadcrumbs) }}
      />

      <PostListSection
        title={TITLE}
        subtitle={
          query
            ? `${results.pageCount === 0 ? "No results" : "Results"} for ${query}`
            : "Find an article by anything written in it."
        }
        results={results}
        // Carries the query, so page two is the second page of the same search.
        // `encodeURIComponent` rather than raw interpolation: a query holding an
        // `&` would otherwise become a second parameter.
        basePath={`${WRITING_CONFIG.searchPath}?q=${encodeURIComponent(query)}`}
        previousLabel="Previous"
        nextLabel="More"
        emptyState={
          <EmptyState message={query ? EMPTY_COPY.searchNoResults(query) : EMPTY_COPY.searchIdle} />
        }
      >
        <div className="pb-2">
          <SearchForm query={query} />
        </div>
      </PostListSection>
    </WritingShell>
  )
}
