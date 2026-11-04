import { RAIL_CARD_WIDTH } from "@/components/ui/card-rail"
import { Skeleton, SkeletonContent } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function PostCardsSkeleton({ rail = false }: { rail?: boolean }) {
  return (
    <SkeletonContent
      label={rail ? "Loading recent writing…" : "Loading articles…"}
      className={rail ? "flex gap-6 overflow-hidden" : "grid gap-6 sm:grid-cols-2 lg:grid-cols-3"}
    >
      {Array.from({ length: rail ? 3 : 6 }, (_, index) => (
        <div
          key={index}
          className={cn(
            "variant-secondary variant-border flex flex-col border-2 border-border bg-card shadow-soft",
            rail && RAIL_CARD_WIDTH
          )}
        >
          <Skeleton className="aspect-[2/1] w-full border-b-2 border-border" />
          <div className="space-y-4 p-6">
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-6 w-3/5" />
            <Skeleton className="h-3 w-2/3" />
            <div className="space-y-2 py-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      ))}
    </SkeletonContent>
  )
}
