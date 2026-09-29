import { EyeOff } from "lucide-react"

import type { PostStatus } from "@/features/blog/types"
import { PREVIEW_TTL_MS } from "@/features/blog/utils/preview-token"

interface PreviewBannerProps {
  status: PostStatus
}

/**
 * Says plainly that this is not the published page.
 *
 * Non-negotiable for a preview: without it, a draft URL shared for review looks
 * exactly like a live article, and the reviewer has no way to know which they are
 * looking at (PRD US-3.3).
 */
export function PreviewBanner({ status }: PreviewBannerProps) {
  return (
    <p
      role="status"
      className="flex flex-wrap items-center gap-3 border-2 border-border bg-[var(--component-variant-tertiary-soft)] px-4 py-3 text-sm font-black uppercase tracking-[0.14em]"
    >
      <EyeOff className="h-4 w-4" aria-hidden />
      Draft preview
      <span className="font-semibold normal-case tracking-normal opacity-80">
        This post is {status} and is not publicly readable. The link expires{" "}
        {/* Derived, so changing the TTL cannot leave the copy claiming otherwise. */}
        {PREVIEW_TTL_MS / 60_000} minutes after it was made.
      </span>
    </p>
  )
}
