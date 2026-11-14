import { BulkPostActions } from "@/features/writing/components/admin/bulk-post-actions"
import { PostSelectionProvider } from "@/features/writing/components/admin/post-selection"
import { Plus } from "lucide-react"
import { useId, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { adminApi, adminKeys } from "@/features/writing/api/client"
import { AdminShell } from "@/admin/components/layout/admin-shell"
import { PostRow } from "@/features/writing/components/admin/post-row"
import { PostTable } from "@/features/writing/components/admin/post-table"
import {
  PostsViewToggle,
  useAdminPostsView,
} from "@/features/writing/components/admin/posts-view-toggle"
import { controlClassNames } from "@/components/ui/variants"
import { ArchiveControls } from "@/features/writing/components/archive-controls"
import { Pagination } from "@/features/writing/components/pagination"
import { PaginationResults } from "@/features/writing/components/pagination-results"
import { QueryState } from "@/features/writing/components/query-state"
import { PostsSkeleton } from "@/features/writing/components/admin/posts-skeleton"
import {
  adminArchiveSearchParams,
  hasAdminArchiveFilters,
  parseAdminArchiveOptions,
} from "@/features/writing/utils/admin-archive-options"
export function Component() {
  const [params] = useSearchParams()
  return (
    <PostSelectionProvider scope={params.toString()}>
      <PostsList />
    </PostSelectionProvider>
  )
}

function PostsList() {
  const resultsId = useId()
  const [params] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  // `params` only changes with the URL, so the options object (and everything the
  // memoized rows and table receive from it) stays the same across unrelated
  // renders such as background refetches.
  const options = useMemo(() => parseAdminArchiveOptions(params), [params])
  const view = useAdminPostsView()
  const query = useQuery({
    queryKey: adminKeys.archive(options),
    queryFn: ({ signal }) => adminApi.archive(options, signal),
    // Retain the table and its focused sorting control while new rows arrive.
    placeholderData: view === "table" ? keepPreviousData : undefined,
  })
  const tags = useQuery({
    queryKey: adminKeys.tags(),
    queryFn: adminApi.tags,
    enabled: filtersOpen,
  })
  const paginationParams = adminArchiveSearchParams({ ...options, page: 1 }).toString()
  const filtered = !!options.q || hasAdminArchiveFilters(options)
  return (
    <AdminShell
      title="Posts"
      activePage="posts"
      actions={
        <Link to="/admin/posts/new" className={`${controlClassNames} px-3 py-2`}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          New post
        </Link>
      }
    >
      <div className="space-y-6" aria-busy={query.isFetching}>
        <ArchiveControls
          admin
          options={options}
          tags={tags.data}
          tagsError={tags.isError}
          retryTags={() => void tags.refetch()}
          onOpenChange={setFiltersOpen}
          onRefresh={() => void query.refetch()}
          refreshing={query.isFetching}
        />
        <BulkPostActions
          posts={query.data?.posts ?? []}
          refreshVersion={query.dataUpdatedAt}
          ready={Boolean(query.data) && !query.isPlaceholderData && !query.isError}
        />
        {query.isError && query.data && (
          <p role="alert" className="text-sm text-destructive">
            Posts could not be refreshed. Your current results are still shown. Try refreshing
            again.
          </p>
        )}
        <PaginationResults
          id={resultsId}
          label={`Posts results, page ${query.data?.page ?? options.page}`}
          ready={!query.isPlaceholderData && (Boolean(query.data) || query.isError)}
          className="space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              {query.data && (
                <>
                  {query.data.total} {query.data.total === 1 ? "post" : "posts"}
                  {options.q ? ` matching “${options.q}”` : ""}
                </>
              )}
            </p>
            <PostsViewToggle view={view} />
          </div>
          {query.isPending ? (
            <PostsSkeleton view={view} />
          ) : query.isError && !query.data ? (
            <QueryState error retry={() => void query.refetch()} label="posts" />
          ) : query.data.posts.length ? (
            view === "table" ? (
              <PostTable
                posts={query.data.posts}
                options={options}
                selectable
                selectionDisabled={query.isPlaceholderData || query.isError}
              />
            ) : (
              <ul className="space-y-3">
                {query.data.posts.map((post) => (
                  <PostRow
                    key={post.id}
                    post={post}
                    selectable
                    selectionDisabled={query.isPlaceholderData || query.isError}
                  />
                ))}
              </ul>
            )
          ) : (
            <div className="border-2 border-dashed border-border px-6 py-16 text-center">
              {filtered ? (
                <p>No posts match these filters. Adjust or clear them to find your posts.</p>
              ) : (
                <p>
                  Nothing written yet. Start with{" "}
                  <Link to="/admin/posts/new" className="underline">
                    a new post
                  </Link>
                  .
                </p>
              )}
            </div>
          )}
        </PaginationResults>
        {query.data && (
          <Pagination
            page={query.data.page}
            pageCount={query.data.pageCount}
            basePath={paginationParams ? `/admin/posts?${paginationParams}` : "/admin/posts"}
            label="Posts pagination"
            previousLabel="Previous"
            nextLabel="Next"
            scrollTargetId={resultsId}
          />
        )}
      </div>
    </AdminShell>
  )
}
