import { ChevronLeft, ChevronRight } from "lucide-react"
import { Link } from "react-router"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const paginationControlClass = cn(buttonVariants({ variant: "ghost", size: "icon" }), "border-0")

interface PaginationProps {
  page: number
  pageCount: number
  // The path pages hang off, e.g. "/writing" or "/writing?q=postgres&tag=react".
  basePath: string
  label: string
  /**
   * What the two directions are called.
   *
   * The unified archive supplies Previous/Next because its selected ordering
   * can be dates, relevance, views or titles. Date-ordered callers can instead
   * use Newer/Older.
   */
  previousLabel?: string
  nextLabel?: string
}

/**
 * `basePath` may already carry a query string with search, tags and other filters.
 * Appending a second `?` would produce a URL whose page number is part of
 * the search term, so the separator is chosen rather than assumed.
 */
const hrefFor = (basePath: string, page: number) =>
  page <= 1 ? basePath : `${basePath}${basePath.includes("?") ? "&" : "?"}page=${page}`

/**
 * Ordinary links, deliberately.
 *
 * Every page beyond the first has to be reachable by following an `<a href>` - a
 * button that fetches the next page on click is invisible to a crawler, so the
 * archive past page one would never be indexed (PRD US-2.1).
 */
export function Pagination({
  page,
  pageCount,
  basePath,
  label,
  previousLabel = "Newer",
  nextLabel = "Older",
}: PaginationProps) {
  if (pageCount <= 1) return null

  const previous = page > 1 ? hrefFor(basePath, page - 1) : null
  const next = page < pageCount ? hrefFor(basePath, page + 1) : null

  return (
    <nav aria-label={label} className="flex items-center justify-between gap-4 pt-2">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
        Page {page} of {pageCount}
      </p>

      <div className="flex shrink-0 items-center gap-2">
        {previous ? (
          <Link
            prefetch="none"
            to={previous}
            rel="prev"
            aria-label={previousLabel}
            title={previousLabel}
            className={paginationControlClass}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : (
          <span
            className={cn(
              paginationControlClass,
              "pointer-events-none text-muted-foreground opacity-50"
            )}
            aria-hidden
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </span>
        )}

        {next ? (
          <Link
            prefetch="none"
            to={next}
            rel="next"
            aria-label={nextLabel}
            title={nextLabel}
            className={paginationControlClass}
          >
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : (
          <span
            className={cn(
              paginationControlClass,
              "pointer-events-none text-muted-foreground opacity-50"
            )}
            aria-hidden
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </nav>
  )
}
