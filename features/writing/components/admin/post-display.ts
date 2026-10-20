import type { VisualVariant } from "@/components/ui/variants"
import type { PostStatus } from "@/features/writing/types"

/** Presentation shared by the admin post cards and table. */

// Published is the loud one, because it is the state where a mistake is public.
export const STATUS_TONE: Record<PostStatus, VisualVariant> = {
  draft: "ghost",
  published: "tertiary",
  archived: "secondary",
}

export const ADMIN_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
}

export const EDIT_ICON_LINK_CLASS =
  "flex h-11 w-11 items-center justify-center border-2 border-border transition-colors hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
