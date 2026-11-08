import type { PostStatus } from "@/features/writing/types"

/** Presentation shared by the admin post cards and table. */

export const STATUS_UNDERLINE: Record<PostStatus, string> = {
  draft: "decoration-[var(--semantic-status-warning)]",
  published: "decoration-[var(--semantic-action-secondary)]",
  archived: "decoration-[var(--semantic-status-neutral)]",
}

export const ADMIN_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
}

export const EDIT_ICON_LINK_CLASS =
  "flex h-11 w-11 items-center justify-center border-2 border-border transition-colors hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
