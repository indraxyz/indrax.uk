import { normaliseQuery } from "@/features/writing/utils/search-query"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "react-router"

import { EmptyState } from "@/features/writing/components/empty-state"
import { PostListSection } from "@/features/writing/components/post-list-section"
import { QueryState } from "@/features/writing/components/query-state"
import { SearchForm } from "@/features/writing/components/search-form"
import { WritingShell } from "@/features/writing/components/writing-shell"
import { writingApi, writingKeys } from "@/features/writing/api/client"
import { WRITING_CONFIG, EMPTY_COPY } from "@/features/writing/config"
import { parsePageParam } from "@/features/writing/utils/page-param"

export const meta = () => [
  { title: "Search - Writing" },
  { name: "robots", content: "noindex, follow" },
]

export default function SearchPage() {
  const [params] = useSearchParams()
  const query = normaliseQuery(params.get("q") ?? undefined)
  const page = parsePageParam(params.get("page") ?? undefined)
  const results = useQuery({
    queryKey: writingKeys.search(query, page),
    queryFn: () => writingApi.search(query, page),
  })
  return (
    <WritingShell
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Writing", path: "/writing" },
        { name: "Search" },
      ]}
    >
      {results.data ? (
        <PostListSection
          title="Search"
          subtitle={
            query
              ? `${results.data.pageCount ? "Results" : "No results"} for ${query}`
              : "Find an article by anything written in it."
          }
          results={results.data}
          basePath={`${WRITING_CONFIG.searchPath}?q=${encodeURIComponent(query)}`}
          previousLabel="Previous"
          nextLabel="More"
          emptyState={
            <EmptyState
              message={query ? EMPTY_COPY.searchNoResults(query) : EMPTY_COPY.searchIdle}
            />
          }
        >
          <SearchForm key={query} query={query} />
        </PostListSection>
      ) : (
        <>
          <h1 className="text-2xl font-black uppercase">Search</h1>
          <SearchForm key={query} query={query} />
          <QueryState error={results.isError} retry={() => void results.refetch()} />
        </>
      )}
    </WritingShell>
  )
}
