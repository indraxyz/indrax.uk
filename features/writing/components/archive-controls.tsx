import { useId, useState, useSyncExternalStore, type FormEvent } from "react"
import { SlidersHorizontal } from "lucide-react"
import { useSearchParams } from "react-router"

import { badgeVariants } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { controlClassNames, fieldClassNames } from "@/components/ui/variants"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { StickyToolbar } from "@/components/sticky-toolbar"
import { QueryState } from "@/features/writing/components/query-state"
import { SearchForm } from "@/features/writing/components/search-form"
import type { TagWithCount } from "@/features/writing/types"
import {
  ARCHIVE_SORT_LABELS,
  ARCHIVE_SORTS,
  archiveSearchParams,
  defaultArchiveOptions,
  hasArchiveFilters,
  isArchiveDate,
  MAX_ARCHIVE_TAGS,
  type ArchiveOptions,
} from "@/features/writing/utils/archive-options"
import { cn } from "@/lib/utils"
import {
  adminArchiveSearchParams,
  defaultAdminArchiveOptions,
  hasAdminArchiveFilters,
  type AdminArchiveOptions,
} from "@/features/writing/utils/admin-archive-options"

const selectClass = cn(fieldClassNames, "mt-2")

const subscribeToHydration = () => () => {}
const hydratedSnapshot = () => true
const serverSnapshot = () => false

interface ArchiveControlsProps {
  options: ArchiveOptions | AdminArchiveOptions
  admin?: boolean
  tags?: TagWithCount[]
  tagsError: boolean
  retryTags: () => void
}

/** The URL owns applied settings; the sheet owns drafts until Apply. */
export function ArchiveControls({
  options,
  admin = false,
  tags,
  tagsError,
  retryTags,
}: ArchiveControlsProps) {
  const [, setParams] = useSearchParams()
  const hydrated = useSyncExternalStore(subscribeToHydration, hydratedSnapshot, serverSnapshot)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(options)
  const [error, setError] = useState("")
  const filterStatusId = useId()
  const active = admin
    ? hasAdminArchiveFilters(options as AdminArchiveOptions)
    : hasArchiveFilters(options)
  const serialize = (settings: ArchiveOptions | AdminArchiveOptions) =>
    admin
      ? adminArchiveSearchParams(settings as AdminArchiveOptions)
      : archiveSearchParams(settings)
  const knownTags = tags ?? []
  // Keep URL-selected tags removable even if they have since lost their last public article.
  const unavailable = draft.tags.filter((slug) => !knownTags.some((tag) => tag.slug === slug))

  function apply(event: FormEvent) {
    event.preventDefault()
    if (
      draft.date === "custom" &&
      ((!draft.from && !draft.to) ||
        (draft.from && !isArchiveDate(draft.from)) ||
        (draft.to && !isArchiveDate(draft.to)) ||
        (draft.from && draft.to && draft.from > draft.to))
    ) {
      setError("Choose at least one valid date, with the start on or before the end.")
      return
    }
    setParams(serialize({ ...draft, q: options.q, page: 1 }))
    setOpen(false)
  }

  function toggleTag(slug: string) {
    setDraft((current) => ({
      ...current,
      tags: current.tags.includes(slug)
        ? current.tags.filter((tag) => tag !== slug)
        : [...current.tags, slug].sort(),
    }))
  }

  return (
    <StickyToolbar className="flex items-stretch gap-3">
      <SearchForm
        query={options.q}
        options={options}
        params={serialize(options)}
        action={admin ? "/admin/posts" : "/writing"}
        label={admin ? "Search posts" : "Search articles"}
      />
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (next) {
            setDraft({ ...options, tags: [...options.tags] })
            setError("")
          }
          setOpen(next)
        }}
      >
        <SheetTrigger
          aria-label="Filters and sort"
          // Firefox otherwise restores the enabled state from the previous page
          // load before React hydrates this initially disabled trigger.
          // Its button-specific autocomplete extension is absent from React's types.
          render={<button type="button" {...{ autoComplete: "off" }} />}
          disabled={!hydrated}
          aria-describedby={filterStatusId}
          className={cn(
            controlClassNames,
            "relative min-h-11 min-w-11 shrink-0 justify-center px-3"
          )}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          {active && (
            <span
              data-active-filters
              className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--primitive-brand-500)]"
              aria-hidden
            />
          )}
          <span id={filterStatusId} className="sr-only">
            {active ? "Active filters" : "No active filters"}
          </span>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="gap-0 rounded-none border-border bg-background data-[side=right]:w-full data-[side=right]:border-l-2 data-[side=right]:sm:max-w-md"
        >
          <SheetHeader className="shrink-0 border-b-2 border-border pr-14">
            <SheetTitle className="font-black uppercase">Filters and sort</SheetTitle>
            <SheetDescription className="sr-only">
              {admin ? "Choose how to manage posts." : "Choose how to explore writing."} Apply when
              you’re ready.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={apply} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
              <label className="block font-bold">
                Sort by
                <select
                  className={selectClass}
                  aria-label="Sort by"
                  value={draft.sort}
                  onChange={(event) =>
                    setDraft({ ...draft, sort: event.target.value as ArchiveOptions["sort"] })
                  }
                >
                  {ARCHIVE_SORTS.map((sort) =>
                    sort === "relevance" ? (
                      <option key={sort} value={sort} disabled={!options.q}>
                        {options.q
                          ? ARCHIVE_SORT_LABELS[sort]
                          : `${ARCHIVE_SORT_LABELS[sort]} (search first to enable)`}
                      </option>
                    ) : (
                      <option key={sort} value={sort}>
                        {ARCHIVE_SORT_LABELS[sort]}
                      </option>
                    )
                  )}
                </select>
              </label>
              {admin && (
                <label className="block font-bold">
                  Status
                  <select
                    className={selectClass}
                    aria-label="Status"
                    value={(draft as AdminArchiveOptions).status}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        status: event.target.value as AdminArchiveOptions["status"],
                      } as AdminArchiveOptions)
                    }
                  >
                    <option value="any">All statuses</option>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
              )}
              <div>
                <label className="block font-bold">
                  Publication date
                  <select
                    className={selectClass}
                    aria-label="Publication date"
                    value={draft.date}
                    onChange={(event) => {
                      setError("")
                      setDraft({ ...draft, date: event.target.value as ArchiveOptions["date"] })
                    }}
                  >
                    <option value="any">Any time</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="year">This year</option>
                    <option value="custom">Custom dates</option>
                  </select>
                </label>
                {admin && draft.date !== "any" && (
                  <p className="mt-2 text-xs text-muted-foreground">Undated posts are excluded.</p>
                )}
                {draft.date === "custom" && (
                  <div className="mt-3 space-y-3">
                    <label className="block font-bold">
                      From
                      <input
                        type="date"
                        className={selectClass}
                        value={draft.from}
                        onChange={(event) => {
                          setError("")
                          setDraft({ ...draft, from: event.target.value })
                        }}
                        aria-invalid={!!error}
                      />
                    </label>
                    <label className="block font-bold">
                      To
                      <input
                        type="date"
                        className={selectClass}
                        value={draft.to}
                        onChange={(event) => {
                          setError("")
                          setDraft({ ...draft, to: event.target.value })
                        }}
                        aria-invalid={!!error}
                      />
                    </label>
                    <p className="text-xs text-muted-foreground">
                      UTC dates. Either end is optional.
                    </p>
                  </div>
                )}
                {error && (
                  <p role="alert" className="mt-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
              </div>
              <label className="block font-bold">
                Reading duration
                <select
                  className={selectClass}
                  aria-label="Reading duration"
                  value={draft.duration}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      duration: event.target.value as ArchiveOptions["duration"],
                    })
                  }
                >
                  <option value="any">Any duration</option>
                  <option value="short">Under 5 minutes</option>
                  <option value="medium">5–10 minutes</option>
                  <option value="long">Over 10 minutes</option>
                </select>
              </label>
              <fieldset>
                <legend className="font-bold">Tags</legend>
                {tagsError ? (
                  <div className="mt-3">
                    <QueryState error retry={retryTags} label="tags" />
                  </div>
                ) : tags === undefined ? (
                  <p role="status" className="mt-3">
                    Loading tags…
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {knownTags.map((tag) => (
                      <button
                        key={tag.slug}
                        type="button"
                        aria-pressed={draft.tags.includes(tag.slug)}
                        disabled={
                          !draft.tags.includes(tag.slug) && draft.tags.length >= MAX_ARCHIVE_TAGS
                        }
                        onClick={() => toggleTag(tag.slug)}
                        className={cn(
                          badgeVariants({
                            variant: draft.tags.includes(tag.slug) ? "primary" : "tertiary",
                          }),
                          "min-h-11 disabled:opacity-50"
                        )}
                      >
                        {tag.name} ({tag.postCount})
                      </button>
                    ))}
                    {knownTags.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        {admin ? "No tags on posts yet." : "No tags with published writing yet."}
                      </p>
                    )}
                  </div>
                )}
                {unavailable.map((slug) => (
                  <button
                    key={slug}
                    type="button"
                    aria-pressed="true"
                    onClick={() => toggleTag(slug)}
                    className={cn(badgeVariants({ variant: "primary" }), "mt-2 min-h-11")}
                  >
                    {slug} (0)
                  </button>
                ))}
                {draft.tags.length >= MAX_ARCHIVE_TAGS && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    You can select up to {MAX_ARCHIVE_TAGS} tags.
                  </p>
                )}
              </fieldset>
            </div>
            <SheetFooter className="shrink-0 border-t-2 border-border pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button
                type="submit"
                variant="primary"
                appearance="flat"
                className="h-auto min-h-11 px-4 py-3 text-xs"
              >
                Apply
              </Button>
              <button
                type="button"
                onClick={() => {
                  setParams(
                    serialize({
                      ...(admin ? defaultAdminArchiveOptions : defaultArchiveOptions),
                      q: options.q,
                    })
                  )
                  setOpen(false)
                }}
                className={cn(controlClassNames, "min-h-11 justify-center px-4 py-3")}
              >
                Clear
              </button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </StickyToolbar>
  )
}
