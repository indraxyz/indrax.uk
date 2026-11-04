import { Skeleton, SkeletonContent } from "@/components/ui/skeleton"
import type { AdminPostsView } from "@/features/writing/utils/admin-posts-view"

export function PostsSkeleton({ view }: { view: AdminPostsView }) {
  return (
    <SkeletonContent label="Loading posts…">
      {view === "table" ? (
        <div data-skeleton-table className="overflow-x-auto border-2 border-border bg-card">
          <table className="w-full min-w-[48rem] border-collapse">
            <thead className="border-b-2 border-border">
              <tr>
                {Array.from({ length: 6 }, (_, column) => (
                  <th key={column} className="px-4 py-4">
                    <Skeleton className="h-3 w-16" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }, (_, row) => (
                <tr key={row} className="border-b border-border last:border-0">
                  {Array.from({ length: 6 }, (_, column) => (
                    <td key={column} className="px-4 py-5">
                      <Skeleton className={column === 0 ? "h-4 w-40" : "h-4 w-16"} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div data-skeleton-cards className="space-y-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="border-2 border-border bg-card p-4">
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1 space-y-3">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
                <Skeleton className="size-11 shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}
    </SkeletonContent>
  )
}
