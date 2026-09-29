import { ChevronLeft, ChevronRight, Layers } from "lucide-react"
import Link from "next/link"

import { BLOG_CONFIG } from "@/features/blog/config"
import type { SeriesContext } from "@/features/blog/types"

const articlePath = (slug: string) => `${BLOG_CONFIG.basePath}/${slug}`

/**
 * Where this article sits in its series, and how to reach the rest of it.
 *
 * Rendered above the body rather than below it: someone landing on part four
 * from a search result needs to know there are three articles before it *before*
 * they read it, not after.
 *
 * `position` and `total` count published parts only - see `SeriesContext`. A
 * reader is never told they are on part 2 of 7 with five of them answering 404.
 */
export function SeriesNav({ context }: { context: SeriesContext }) {
  const { series, position, total, previous, next } = context

  return (
    <nav
      aria-label={`${series.title} series navigation`}
      className="border-2 border-border bg-muted/40 px-4 py-3"
    >
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
        <Layers className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Part {position} of {total}
        </span>
        <span aria-hidden>·</span>
        <Link
          href={`${BLOG_CONFIG.seriesPath}/${series.slug}`}
          className="text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {series.title}
        </Link>
      </p>

      {previous || next ? (
        <div className="mt-2 flex flex-col gap-1 text-sm font-semibold sm:flex-row sm:justify-between sm:gap-4">
          {previous ? (
            <Link
              href={articlePath(previous.slug)}
              rel="prev"
              className="flex items-center gap-1 text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {/* Named rather than "Previous": the title is what tells a reader
                  whether they have already read it. */}
              <span className="line-clamp-1">{previous.title}</span>
            </Link>
          ) : (
            <span />
          )}

          {next ? (
            <Link
              href={articlePath(next.slug)}
              rel="next"
              className="flex items-center gap-1 text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:justify-end"
            >
              <span className="line-clamp-1">{next.title}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}
    </nav>
  )
}
