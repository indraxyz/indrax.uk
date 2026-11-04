import { ChevronDown } from "lucide-react"
import { useEffect, useState, type MouseEvent } from "react"

import { stickyHeaderOffsetClassNames } from "@/components/scroll-header"
import type { TocEntry } from "@/features/writing/types"
import { cn } from "@/lib/utils"

export interface ContentsNode extends TocEntry {
  children: ContentsNode[]
}

/** Keep authored hierarchy without inventing missing parent headings. */
export function buildContentsTree(entries: TocEntry[]): ContentsNode[] {
  const roots: ContentsNode[] = []
  const parents: ContentsNode[] = []
  for (const entry of entries) {
    while (parents.length && parents[parents.length - 1].level >= entry.level) parents.pop()
    const node = { ...entry, children: [] }
    const parent = parents[parents.length - 1]
    if (parent) parent.children.push(node)
    else roots.push(node)
    parents.push(node)
  }
  return roots
}

function ContentsList({ entries, nested = false }: { entries: ContentsNode[]; nested?: boolean }) {
  function navigate(event: MouseEvent<HTMLAnchorElement>, id: string) {
    const disclosure = event.currentTarget.closest("details")
    if (
      !disclosure ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    // Close before native anchor scrolling, then transfer focus out of the hidden list.
    disclosure.open = false
    document.getElementById(id)?.focus({ preventScroll: true })
  }

  return (
    <ol className={cn("space-y-2", nested && "mt-2 border-l-2 border-border pl-3")}>
      {entries.map((entry) => (
        <li key={entry.id}>
          <a
            href={`#${entry.id}`}
            onClick={(event) => navigate(event, entry.id)}
            className="block py-1 text-sm font-semibold leading-snug text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {entry.text}
          </a>
          {entry.children.length > 0 && <ContentsList entries={entry.children} nested />}
        </li>
      ))}
    </ol>
  )
}

/** The desktop sidebar and native mobile disclosure share the same heading tree. */
export function TableOfContents({
  entries,
  className,
}: {
  entries: TocEntry[]
  className?: string
}) {
  const [enhanced, setEnhanced] = useState(false)
  useEffect(() => setEnhanced(true), [])
  if (!entries.length) return null
  const tree = buildContentsTree(entries)
  const navigationClassName =
    "max-h-[min(60svh,calc(100svh_-_var(--site-header-offset,6rem)_-_5rem))] overflow-y-auto p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"

  return (
    <aside
      data-article-toc
      data-enhanced={enhanced}
      className={cn(
        "z-30 self-start border-2 border-border bg-background shadow-soft data-[enhanced=true]:sticky lg:sticky lg:top-[calc(var(--site-header-offset,6rem)_+_1rem)] print:hidden",
        stickyHeaderOffsetClassNames,
        className
      )}
    >
      <details className="group lg:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
          On this page
          <ChevronDown
            className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden
          />
        </summary>
        <nav
          aria-label="On this page"
          tabIndex={0}
          className={cn(navigationClassName, "border-t-2 border-border")}
        >
          <ContentsList entries={tree} />
        </nav>
      </details>
      <nav
        aria-label="On this page"
        tabIndex={0}
        className={cn(navigationClassName, "hidden lg:block")}
      >
        <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
          On this page
        </p>
        <ContentsList entries={tree} />
      </nav>
    </aside>
  )
}
