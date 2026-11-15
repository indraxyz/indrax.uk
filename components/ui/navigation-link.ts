import { cn } from "@/lib/utils"
import { focusControlClassNames } from "@/components/ui/variants"

/** Shared current-page treatment for public/admin navigation and breadcrumbs. */
export const currentPageClassNames = "bg-muted text-foreground"

export const navigationLinkClassNames = cn(
  "inline-flex min-h-11 items-center justify-center px-2 py-1 text-xs font-black uppercase tracking-[0.14em] text-foreground no-underline transition-colors hover:bg-muted hover:no-underline aria-[current=page]:bg-muted",
  focusControlClassNames
)
