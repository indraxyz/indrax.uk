import { Search } from "lucide-react"

import { controlClassNames } from "@/components/ui/variants"
import { BLOG_CONFIG } from "@/features/blog/config"
import { cn } from "@/lib/utils"

/**
 * A plain GET form, with no JavaScript behind it.
 *
 * Submitting navigates to `/blog/search?q=...`, which is what makes a search
 * result a URL: it can be linked, bookmarked, shared and read back by the person
 * who ran it. A fetch-on-keystroke box would be smoother and would produce
 * nothing anyone could send to someone else, and it would put a database query
 * behind every keypress rather than behind every search (threat T-11).
 *
 * It also means search works before hydration, and in a browser that never runs
 * the bundle at all - the same property the rest of the reading experience has.
 */
export function SearchForm({ query }: { query: string }) {
  return (
    <form
      action={BLOG_CONFIG.searchPath}
      method="get"
      role="search"
      className="flex flex-col gap-3 sm:flex-row"
    >
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          name="q"
          // Echoed back so the box still holds what was searched for after the
          // navigation, which is what makes refining a search possible.
          defaultValue={query}
          // The server refuses anything longer anyway; saying so here turns a
          // silently empty result into a limit the browser enforces.
          maxLength={BLOG_CONFIG.maxQueryLength}
          placeholder="Search articles"
          aria-label="Search articles"
          className={cn(
            "w-full rounded-none border-2 border-border bg-background py-2 pl-9 pr-3",
            "text-sm font-medium text-foreground placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
        />
      </div>

      <button type="submit" className={cn(controlClassNames, "px-4 py-2")}>
        Search
      </button>
    </form>
  )
}
