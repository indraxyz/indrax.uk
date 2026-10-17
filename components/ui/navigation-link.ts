import { cn } from "@/lib/utils"
import { focusControlClassNames } from "@/components/ui/variants"

/** Shared current-page treatment for public/admin navigation and breadcrumbs. */
export const currentPageClassNames = "border-ring bg-muted text-foreground"

export const navigationLinkClassNames = cn(
  "inline-flex min-h-11 items-center justify-center border-b-2 border-transparent px-2 py-1 text-xs font-black uppercase tracking-[0.14em] text-foreground transition-colors hover:border-ring hover:bg-muted aria-[current=page]:border-ring aria-[current=page]:bg-muted",
  focusControlClassNames
)
