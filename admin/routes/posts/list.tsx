import { Plus } from "lucide-react"
import { Link, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { adminApi, adminKeys } from "@/features/writing/api/client"
import { AdminShell } from "@/admin/components/layout/admin-shell"
import { PostRow } from "@/features/writing/components/admin/post-row"
import { controlClassNames } from "@/components/ui/variants"
import { ArchiveControls } from "@/features/writing/components/archive-controls"
import { Pagination } from "@/features/writing/components/pagination"
import { QueryState } from "@/features/writing/components/query-state"
import {
  adminArchiveSearchParams,
  hasAdminArchiveFilters,
  parseAdminArchiveOptions,
} from "@/features/writing/utils/admin-archive-options"
export function Component() {
  const [params] = useSearchParams()
  const options = parseAdminArchiveOptions(params)
  const query = useQuery({
    queryKey: adminKeys.archive(options),
    queryFn: ({ signal }) => adminApi.archive(options, signal),
  })
  const tags = useQuery({ queryKey: adminKeys.tags(), queryFn: adminApi.tags })
  const paginationParams = adminArchiveSearchParams({ ...options, page: 1 }).toString()
  const filtered = !!options.q || hasAdminArchiveFilters(options)
  return (
    <AdminShell
      title="Posts"
      activePage="posts"
      actions={
        <Link to="/admin/new" className={`${controlClassNames} px-3 py-2`}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          New post
        </Link>
      }
    >
      <div className="space-y-6">
        <ArchiveControls
          admin
          options={options}
          tags={tags.data}
          tagsError={tags.isError}
          retryTags={() => void tags.refetch()}
        />
        {query.data && (
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            {query.data.total} {query.data.total === 1 ? "post" : "posts"}
            {options.q ? ` matching “${options.q}”` : ""}
          </p>
        )}
        {query.isPending || query.isError ? (
          <QueryState error={query.isError} retry={() => void query.refetch()} label="posts" />
        ) : query.data.posts.length ? (
          <ul className="space-y-3">
            {query.data.posts.map((post) => (
              <PostRow key={post.id} post={post} />
            ))}
          </ul>
        ) : (
          <div className="border-2 border-dashed border-border px-6 py-16 text-center">
            {filtered ? (
              <p>No posts match these filters. Adjust or clear them to find your posts.</p>
            ) : (
              <p>
                Nothing written yet. Start with{" "}
                <Link to="/admin/new" className="underline">
                  a new post
                </Link>
                .
              </p>
            )}
          </div>
        )}
        {query.data && (
          <Pagination
            page={query.data.page}
            pageCount={query.data.pageCount}
            basePath={paginationParams ? `/admin/posts?${paginationParams}` : "/admin/posts"}
            label="Posts pagination"
            previousLabel="Previous"
            nextLabel="Next"
          />
        )}
      </div>
    </AdminShell>
  )
}
