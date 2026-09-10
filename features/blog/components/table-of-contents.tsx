import type { TocEntry } from "@/features/blog/types"
import { cn } from "@/lib/utils"

// Below this there is nothing to navigate: a contents list for two headings costs
// more attention than it saves.
const MINIMUM_ENTRIES = 3

interface TableOfContentsProps {
  entries: TocEntry[]
  className?: string
}

/**
 * In-page navigation, built from the headings the render pass already collected.
 *
 * Plain anchors to ids `rehype-slug` assigned, so it works with JavaScript
 * disabled, needs no scroll listener, and costs the reader nothing. Its absence on
 * a short article is deliberate rather than an oversight.
 */
export function TableOfContents({ entries, className }: TableOfContentsProps) {
  if (entries.length < MINIMUM_ENTRIES) return null

  return (
    <nav
      aria-labelledby="toc-heading"
      className={cn("border-2 border-border bg-[var(--color-muted)] p-4", className)}
    >
      <h2
        id="toc-heading"
        className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground"
      >
        On this page
      </h2>

      <ol className="space-y-1.5">
        {entries.map((entry) => (
          <li key={entry.id} className={entry.level === 3 ? "pl-4" : undefined}>
            <a
              href={`#${entry.id}`}
              className="text-sm font-semibold leading-snug text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
