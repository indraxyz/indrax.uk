import { useEffect, useRef, useState } from "react"
import { Form, useNavigate, useNavigation } from "react-router"
import { Search, X } from "lucide-react"

import { WRITING_CONFIG } from "@/features/writing/config"
import { fieldClassNames, focusControlClassNames } from "@/components/ui/variants"
import { cn } from "@/lib/utils"
import { archiveSearchParams, type ArchiveOptions } from "@/features/writing/utils/archive-options"

/** Debounced GET navigation keeps searches shareable; Enter submits immediately. */
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
  const navigation = useNavigation()
  const input = useRef<HTMLInputElement>(null)
  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState({ query, value: query, submitted: null as string | null })
  // A completed search acknowledges its submitted text, preserving any later
  // keystrokes. Other navigations (including Back) restore the committed query.
  if (draft.query !== query)
    setDraft({ query, value: draft.submitted === query ? draft.value : query, submitted: null })
  const preserved = params
    ? new URLSearchParams(params)
    : options
      ? archiveSearchParams(options, { includePage: false })
      : new URLSearchParams()
  preserved.delete("q")
  preserved.delete("page")
  const preservedQuery = preserved.toString()
  useEffect(() => {
    if (composing || draft.query !== query || draft.value.trim() === query) return
    const timer = window.setTimeout(() => {
      setDraft((current) => ({ ...current, submitted: draft.value.trim() }))
      const search = new URLSearchParams(preservedQuery)
      if (draft.value.trim()) search.set("q", draft.value.trim())
      const suffix = search.toString()
      void navigate(suffix ? `${action}?${suffix}` : action, { replace: true })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [action, composing, draft.query, draft.value, navigate, preservedQuery, query])
  return (
    <Form
      action={action}
      method="get"
      role="search"
      onSubmit={() => setDraft((current) => ({ ...current, submitted: current.value.trim() }))}
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
          enterKeyHint="search"
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={() => setComposing(false)}
          // Echoed back so the box still holds what was searched for after the
          // navigation, which is what makes refining a search possible.
          value={draft.query === query ? draft.value : query}
          onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
          // The server refuses anything longer anyway; saying so here turns a
          // silently empty result into a limit the browser enforces.
          maxLength={WRITING_CONFIG.maxQueryLength}
          placeholder={label}
          aria-label={label}
          className={cn(
            fieldClassNames,
            "h-full min-h-11 w-full py-2 pl-9 pr-11 font-medium [&::-webkit-search-cancel-button]:appearance-none"
          )}
        />
        {draft.value && (
          <button
            type="button"
            aria-label="Clear search"
            className={cn(
              focusControlClassNames,
              "absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:ring-inset"
            )}
            onClick={() => {
              setDraft({ query, value: "", submitted: query ? "" : null })
              input.current?.focus()
              if (query || navigation.state !== "idle") {
                const search = preserved.toString()
                void navigate(search ? `${action}?${search}` : action)
              }
            }}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </Form>
  )
}
