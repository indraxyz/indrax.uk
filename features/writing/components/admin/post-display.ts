import type { PostStatus } from "@/features/writing/types"

/** Presentation shared by the admin post cards and table. */

export const STATUS_UNDERLINE: Record<PostStatus, string> = {
  draft: "decoration-[var(--semantic-status-warning)]",
  published: "decoration-[var(--component-post-status-published)]",
  archived: "decoration-[var(--component-post-status-archived)]",
}

export const ADMIN_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
}
