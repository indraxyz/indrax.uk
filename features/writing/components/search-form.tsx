import { Form } from "react-router"
import { Search } from "lucide-react"

import { controlClassNames } from "@/components/ui/variants"
import { WRITING_CONFIG } from "@/features/writing/config"
import { cn } from "@/lib/utils"

/** A GET navigation keeps searches shareable and avoids requests on every keypress. */
export function SearchForm({ query }: { query: string }) {
  return (
    <Form
      action={WRITING_CONFIG.searchPath}
      method="get"
      role="search"
      className="flex items-stretch gap-3"
    >
      <div className="relative min-w-0 flex-1">
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
          maxLength={WRITING_CONFIG.maxQueryLength}
          placeholder="Search articles"
          aria-label="Search articles"
          className={cn(
            "w-full rounded-none border-2 border-border bg-background py-2 pl-9 pr-3",
            "text-sm font-medium text-foreground placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
        />
      </div>

      <button
        type="submit"
        aria-label="Search"
        className={cn(controlClassNames, "shrink-0 justify-center px-3 py-2 sm:px-4")}
      >
        <Search className="h-4 w-4 sm:hidden" aria-hidden="true" />
        <span className="hidden sm:inline">Search</span>
      </button>
    </Form>
  )
}
