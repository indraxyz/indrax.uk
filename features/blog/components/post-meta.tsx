import { CalendarDays, Clock, RefreshCw } from "lucide-react"

import type { PostSummary } from "@/features/blog/types"
import { cn, formatDate } from "@/lib/utils"

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
}

// A post is only "updated" if the change came meaningfully after publication.
// Every row's `updated_at` is set on write, so without a threshold a post would
// claim to have been revised the moment it went live (PRD US-1.3).
const UPDATED_THRESHOLD_MS = 24 * 60 * 60 * 1000

interface PostMetaProps {
  post: Pick<PostSummary, "publishedAt" | "updatedAt" | "readingTime">
  className?: string
}

export function PostMeta({ post, className }: PostMetaProps) {
  const published = post.publishedAt
  const wasUpdated =
    published !== null &&
    new Date(post.updatedAt).getTime() - new Date(published).getTime() > UPDATED_THRESHOLD_MS

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground",
        className
      )}
    >
      {published && (
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
          {/* A machine-readable timestamp beside the human one, so a crawler and a
              reader see the same date (PRD US-1.3). */}
          <time dateTime={published}>{formatDate(published, DATE_FORMAT)}</time>
        </span>
      )}

      {wasUpdated && (
        <span className="flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Updated <time dateTime={post.updatedAt}>{formatDate(post.updatedAt, DATE_FORMAT)}</time>
        </span>
      )}

      {post.readingTime && (
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {post.readingTime} min read
        </span>
      )}
    </div>
  )
}
