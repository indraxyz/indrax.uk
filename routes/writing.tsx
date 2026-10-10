import { SITE_URL } from "@/features/resume/config"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams, type MetaFunction, type ClientLoaderFunctionArgs } from "react-router"
import { getBrowserQueryClient } from "@/components/query-provider"

import { ArchiveControls } from "@/features/writing/components/archive-controls"
import { EmptyState } from "@/features/writing/components/empty-state"
import { PostListSection } from "@/features/writing/components/post-list-section"
import { QueryState } from "@/features/writing/components/query-state"
import { WritingShell } from "@/features/writing/components/writing-shell"
import { writingApi, writingKeys } from "@/features/writing/api/client"
import { WRITING_CONFIG, EMPTY_COPY, SECTION_COPY } from "@/features/writing/config"
import {
  archiveSearchParams,
  hasArchiveFilters,
  parseArchiveOptions,
} from "@/features/writing/utils/archive-options"

// Public lists keep the migration's browser loading model; article detail retains SSR.
export function loader() {
  return null
}

export async function clientLoader({ request }: ClientLoaderFunctionArgs) {
  const options = parseArchiveOptions(new URL(request.url).searchParams)
  const client = getBrowserQueryClient()
  await Promise.all([
    client.prefetchQuery({
      queryKey: writingKeys.archive(options),
      queryFn: ({ signal }) => writingApi.archive(options, signal),
    }),
    client.prefetchQuery({ queryKey: writingKeys.tags(), queryFn: writingApi.tags }),
  ])
  return null
}

export const meta: MetaFunction = ({ location }) => {
  const options = parseArchiveOptions(new URLSearchParams(location.search))
  const filtered = !!options.q || hasArchiveFilters(options)
  return [
    { title: options.page > 1 ? `Writing - page ${options.page}` : "Writing" },
    ...(filtered ? [{ name: "robots", content: "noindex, follow" }] : []),
    {
      tagName: "link",
      rel: "canonical",
      href: new URL(
        !filtered && options.page > 1 ? `/writing?page=${options.page}` : "/writing",
        SITE_URL
      ).href,
    },
  ]
}

export default function WritingPage() {
  const [params] = useSearchParams()
  const options = parseArchiveOptions(params)
  const posts = useQuery({
    queryKey: writingKeys.archive(options),
    queryFn: ({ signal }) => writingApi.archive(options, signal),
  })
  const tags = useQuery({ queryKey: writingKeys.tags(), queryFn: writingApi.tags })
  const query = archiveSearchParams(options, { includePage: false }).toString()
  const results = posts.data ?? { posts: [], page: options.page, pageCount: 0 }
  const empty = options.q
    ? EMPTY_COPY.searchNoResults(options.q)
    : hasArchiveFilters(options)
      ? "No articles match these filters. Adjust or clear them to explore more writing."
      : EMPTY_COPY.writing

  return (
    <WritingShell>
      <PostListSection
        title={WRITING_CONFIG.title}
        subtitle={SECTION_COPY.writing}
        results={results}
        basePath={query ? `/writing?${query}` : "/writing"}
        previousLabel="Previous"
        nextLabel="Next"
        emptyState={
          posts.isPending || posts.isError ? (
            <QueryState error={posts.isError} retry={() => void posts.refetch()} />
          ) : (
            <EmptyState message={empty} />
          )
        }
      >
        <div className="space-y-4">
          <ArchiveControls
            options={options}
            tags={tags.data}
            tagsError={tags.isError}
            retryTags={() => void tags.refetch()}
          />
          {posts.data && (
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              {posts.data.total} {posts.data.total === 1 ? "article" : "articles"}
              {options.q ? ` matching “${options.q}”` : ""}
            </p>
          )}
        </div>
      </PostListSection>
    </WritingShell>
  )
}
