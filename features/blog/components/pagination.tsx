import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

import { controlClassNames } from "@/components/ui/variants"
import { cn } from "@/lib/utils"

interface PaginationProps {
  page: number
  pageCount: number
  // The path pages hang off, e.g. "/blog" or "/blog/tag/typescript".
  basePath: string
  label: string
}

const hrefFor = (basePath: string, page: number) =>
  page <= 1 ? basePath : `${basePath}?page=${page}`

/**
 * Ordinary links, deliberately.
 *
 * Every page beyond the first has to be reachable by following an `<a href>` - a
 * button that fetches the next page on click is invisible to a crawler, so the
 * archive past page one would never be indexed (PRD US-2.1).
 */
export function Pagination({ page, pageCount, basePath, label }: PaginationProps) {
  if (pageCount <= 1) return null

  const previous = page > 1 ? hrefFor(basePath, page - 1) : null
  const next = page < pageCount ? hrefFor(basePath, page + 1) : null

  return (
    <nav aria-label={label} className="flex items-center justify-between gap-4 pt-2">
      {previous ? (
        <Link href={previous} rel="prev" className={cn(controlClassNames, "px-4 py-2")}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Newer
        </Link>
      ) : (
        <span
          className={cn(
            controlClassNames,
            "px-4 py-2 cursor-default opacity-40 hover:bg-transparent"
          )}
          aria-hidden
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Newer
        </span>
      )}

      <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
        Page {page} of {pageCount}
      </p>

      {next ? (
        <Link href={next} rel="next" className={cn(controlClassNames, "px-4 py-2")}>
          Older
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : (
        <span
          className={cn(
            controlClassNames,
            "px-4 py-2 cursor-default opacity-40 hover:bg-transparent"
          )}
          aria-hidden
        >
          Older
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
      )}
    </nav>
  )
}
