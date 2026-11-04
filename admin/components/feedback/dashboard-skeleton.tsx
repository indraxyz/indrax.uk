import { Skeleton, SkeletonContent } from "@/components/ui/skeleton"

export function DashboardSkeleton() {
  return (
    <SkeletonContent label="Loading dashboard…" className="space-y-8">
      <Skeleton className="h-4 w-48" />
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-3 border-2 border-border bg-card px-5 py-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-16" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3 border-2 border-border bg-card p-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="space-y-3 border-2 border-border bg-card px-5 py-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonContent>
  )
}
