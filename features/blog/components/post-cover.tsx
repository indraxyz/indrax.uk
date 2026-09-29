import type { PostSummary } from "@/features/blog/types"
import { cn, isAllowedMediaUrl } from "@/lib/utils"

// The stored aspect ratio for every cover. Fixed rather than measured, because
// the ratio is what reserves the space before the bytes arrive - a cover cannot
// contribute layout shift if the box was already the right shape (PRD US-2.1).
const COVER_WIDTH = 1200
const COVER_HEIGHT = 600

interface PostCoverProps {
  post: Pick<PostSummary, "coverUrl" | "coverAlt">
  className?: string
  priority?: boolean
}

/**
 * A post's cover image, or nothing.
 *
 * Nothing is the common case today: covers cannot be uploaded until the authoring
 * phase lands, and `isAllowedMediaUrl` returns false while no media origin is
 * configured.
 *
 * A plain `<img>` rather than `next/image`, for two reasons. The optimiser's
 * default loader does not run on Cloudflare Workers, which is where this deploys -
 * so the component would work locally and fail in production. And `next/image`
 * costs about 15KB of client JavaScript on a page whose whole point is that it
 * ships none; paying that for a feature that cannot render yet is the wrong trade.
 * Explicit `width` and `height` give the same reserved space the optimiser would.
 */
export function PostCover({ post, className, priority = false }: PostCoverProps) {
  if (!isAllowedMediaUrl(post.coverUrl)) return null

  return (
    <div data-print-clip className={cn("border-b-2 border-border", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={post.coverUrl}
        // Empty alt is correct for a decorative cover, and the validator requires
        // alt text before a post carrying one can be published - so a missing
        // string here means decorative, not forgotten.
        alt={post.coverAlt ?? ""}
        width={COVER_WIDTH}
        height={COVER_HEIGHT}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        className="aspect-[2/1] w-full object-cover"
      />
    </div>
  )
}
