import { useRef, useState } from "react"
import { Form, useNavigate } from "react-router"
import { Search, X } from "lucide-react"

import { controlClassNames } from "@/components/ui/variants"
import { WRITING_CONFIG } from "@/features/writing/config"
import { cn } from "@/lib/utils"
import { archiveSearchParams, type ArchiveOptions } from "@/features/writing/utils/archive-options"

/** A GET navigation keeps searches shareable and avoids requests on every keypress. */
export function SearchForm({
  query,
  options,
  action = WRITING_CONFIG.basePath,
  label = "Search articles",
  params,
}: {
  query: string
  options?: ArchiveOptions
  action?: string
  label?: string
  params?: URLSearchParams
}) {
  const navigate = useNavigate()
  const input = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState({ query, value: query })
  // Reset draft text when navigation changes the applied query, keeping the input mounted.
  if (draft.query !== query) setDraft({ query, value: query })
  const preserved = params
    ? new URLSearchParams(params)
    : options
      ? archiveSearchParams(options, { includePage: false })
      : new URLSearchParams()
  preserved.delete("q")
  preserved.delete("page")
  return (
    <Form
      action={action}
      method="get"
      role="search"
      className="flex min-w-0 flex-1 items-stretch gap-3"
    >
      {Array.from(preserved).map(([name, value]) => (
        <input key={`${name}-${value}`} type="hidden" name={name} value={value} />
      ))}
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          ref={input}
          type="search"
          name="q"
          // Echoed back so the box still holds what was searched for after the
          // navigation, which is what makes refining a search possible.
          value={draft.query === query ? draft.value : query}
          onChange={(event) => setDraft({ query, value: event.target.value })}
          // The server refuses anything longer anyway; saying so here turns a
          // silently empty result into a limit the browser enforces.
          maxLength={WRITING_CONFIG.maxQueryLength}
          placeholder={label}
          aria-label={label}
          className={cn(
            "h-full min-h-11 w-full rounded-none border-2 border-border bg-background py-2 pl-9 pr-11 [&::-webkit-search-cancel-button]:appearance-none",
            "text-sm font-medium text-foreground placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
        />
        {draft.value && (
          <button
            type="button"
            aria-label="Clear search"
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            onClick={() => {
              setDraft({ query, value: "" })
              input.current?.focus()
              if (query) {
                const search = preserved.toString()
                void navigate(search ? `${action}?${search}` : action)
              }
            }}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <button
        type="submit"
        aria-label="Search"
        className={cn(controlClassNames, "min-h-11 shrink-0 justify-center px-3 py-2 sm:px-4")}
      >
        <Search className="h-4 w-4 sm:hidden" aria-hidden="true" />
        <span className="hidden sm:inline">Search</span>
      </button>
    </Form>
  )
}
