import { PencilLine } from "lucide-react"
import { memo } from "react"
import { Link } from "react-router"

import { Badge } from "@/components/ui/badge"
import { PostActions } from "./post-actions"
import { ADMIN_DATE_FORMAT, EDIT_ICON_LINK_CLASS, STATUS_TONE } from "./post-display"
import { PostCover } from "@/features/writing/components/post-cover"
import type { AdminPostSummary } from "@/features/writing/types"
import { mediaUrl, formatDate } from "@/lib/utils"

/**
 * One post in the admin card list.
 *
 * Memoized: TanStack Query keeps unchanged posts referentially equal across
 * refetches, so after a status change or delete only the affected row renders.
 */
export const PostRow = memo(function PostRow({ post }: { post: AdminPostSummary }) {
  return (
    <li className="flex flex-col items-stretch border-2 border-border bg-card sm:flex-row">
      {mediaUrl(post.coverUrl) && (
        <Link
          to={`/admin/posts/edit/${post.id}`}
          aria-label={`Edit cover for ${post.title}`}
          className="relative h-40 w-full shrink-0 self-stretch overflow-hidden border-b-2 border-border focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-auto sm:w-48 sm:border-b-0 sm:border-r-2 lg:w-56"
        >
          <PostCover
            post={post}
            className="h-full border-b-0 [&_img]:absolute [&_img]:inset-0 [&_img]:h-full [&_img]:w-full [&_img]:aspect-auto"
          />
        </Link>
      )}
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3 p-3 sm:gap-4 sm:p-4">
        <div className="min-w-0 basis-full space-y-1.5 sm:basis-0 sm:flex-1">
          <div className="space-y-2">
            <Badge variant={STATUS_TONE[post.status]}>{post.status}</Badge>
            <div>
              <Link
                to={`/admin/posts/edit/${post.id}`}
                className="break-words text-base font-black uppercase tracking-tight hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {post.title}
              </Link>
            </div>
          </div>

          {post.excerpt && (
            <p className="line-clamp-2 break-words text-sm font-medium leading-relaxed text-foreground">
              {post.excerpt}
            </p>
          )}

          <p className="break-words text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
            {post.publishedAt
              ? `Published ${formatDate(post.publishedAt, ADMIN_DATE_FORMAT)}`
              : "Never published"}
            {" · "}
            Edited {formatDate(post.updatedAt, ADMIN_DATE_FORMAT)}
            {post.tags.length > 0 && ` · ${post.tags.map((tag) => tag.name).join(", ")}`}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link
            to={`/admin/posts/edit/${post.id}`}
            className={EDIT_ICON_LINK_CLASS}
            aria-label={`Edit ${post.title}`}
          >
            <PencilLine className="h-4 w-4" aria-hidden />
          </Link>

          <PostActions post={post} context="list" />
        </div>
      </div>
    </li>
  )
})
