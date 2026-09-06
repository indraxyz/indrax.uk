import { ExternalLink, PencilLine } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import type { VisualVariant } from "@/components/ui/variants"
import { BLOG_CONFIG } from "@/features/blog/config"
import type { AdminPostSummary } from "@/features/blog/data/admin-queries"
import type { PostStatus } from "@/features/blog/types"
import { formatDate } from "@/lib/utils"

// Published is the loud one, because it is the state where a mistake is public.
const STATUS_TONE: Record<PostStatus, VisualVariant> = {
  draft: "ghost",
  published: "tertiary",
  archived: "secondary",
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }

export function PostRow({ post }: { post: AdminPostSummary }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 border-2 border-border bg-card px-4 py-3">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_TONE[post.status]}>{post.status}</Badge>
          <Link
            href={`/admin/edit/${post.id}`}
            className="text-base font-black uppercase tracking-tight hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {post.title}
          </Link>
        </div>

        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
          {post.publishedAt
            ? `Published ${formatDate(post.publishedAt, DATE_FORMAT)}`
            : "Never published"}
          {" · "}
          Edited {formatDate(post.updatedAt, DATE_FORMAT)}
          {post.tags.length > 0 && ` · ${post.tags.map((tag) => tag.name).join(", ")}`}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/admin/edit/${post.id}`}
          className="flex h-9 w-9 items-center justify-center border-2 border-border transition-colors hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label={`Edit ${post.title}`}
        >
          <PencilLine className="h-4 w-4" aria-hidden />
        </Link>

        {/* Only published posts have a public page to look at; linking a draft
            would be a link to a 404. */}
        {post.status === "published" && (
          <Link
            href={`${BLOG_CONFIG.basePath}/${post.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 w-9 items-center justify-center border-2 border-border transition-colors hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={`View ${post.title} on the site`}
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </div>
    </li>
  )
}
