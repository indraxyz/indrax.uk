import { ChevronDown, ChevronRight } from "lucide-react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react"

import { stickyHeaderOffsetClassNames } from "@/components/scroll-header"
import type { TocEntry } from "@/features/writing/types"
import { cn } from "@/lib/utils"
import styles from "./article-navigation.module.css"

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

function containsHeading(entries: ContentsNode[], id: string | null): boolean {
  return entries.some((entry) => entry.id === id || containsHeading(entry.children, id))
}

function ContentsList({
  entries,
  activeId,
  nested = false,
}: {
  entries: ContentsNode[]
  activeId: string | null
  nested?: boolean
}) {
  function navigate(event: MouseEvent<HTMLAnchorElement>, id: string) {
    const disclosure = event.currentTarget.closest<HTMLDetailsElement>("[data-toc-mobile]")
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
    <ol className={cn("pl-3", nested && styles.guideChildren)}>
      {entries.map((entry) => {
        const current = entry.id === activeId
        const ancestor = containsHeading(entry.children, activeId)
        return (
          <li key={entry.id} className="relative">
            <a
              data-toc-row
              href={`#${entry.id}`}
              onClick={(event) => navigate(event, entry.id)}
              aria-current={current ? "location" : undefined}
              aria-description={ancestor ? "Contains the current section" : undefined}
              data-toc-ancestor={ancestor || undefined}
              className={cn(
                "flex min-h-9 items-center break-words py-2 text-[13px] font-medium leading-relaxed underline-offset-4 transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                entry.children.length > 0 && "pr-9",
                current
                  ? "font-semibold text-primary"
                  : ancestor
                    ? "text-foreground"
                    : "text-muted-foreground"
              )}
            >
              {entry.text}
            </a>
            {entry.children.length > 0 && (
              <details data-toc-branch className="[&[open]>summary>svg]:rotate-90">
                <summary
                  aria-label={`Child sections for ${entry.text}`}
                  className={cn(
                    "absolute right-0 top-0 flex size-9 cursor-pointer list-none items-center justify-center transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none [&::-webkit-details-marker]:hidden",
                    ancestor ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <ChevronRight
                    className="size-3.5 transition-transform motion-reduce:transition-none"
                    aria-hidden
                  />
                </summary>
                <ContentsList entries={entry.children} activeId={activeId} nested />
              </details>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Draw the visible hierarchy as one stroke, so joins cannot overlap or drift. */
function ContentsTree({ entries, activeId }: { entries: ContentsNode[]; activeId: string | null }) {
  const treeRef = useRef<HTMLDivElement>(null)
  const [path, setPath] = useState("")
  useLayoutEffect(() => {
    const tree = treeRef.current
    if (!tree) return
    let frame = 0
    const measure = () => {
      frame = 0
      const bounds = tree.getBoundingClientRect()
      const list = tree.querySelector("ol")
      const gutter = list ? parseFloat(getComputedStyle(list).paddingLeft) : 0
      const rows = Array.from(tree.querySelectorAll<HTMLElement>("[data-toc-row]"))
        // Closed native details can retain descendant layout rectangles. Those
        // hidden rows must not contribute points to the visible guide.
        .filter((row) => !row.closest("details:not([open])"))
        .map((row) => row.getBoundingClientRect())
        .filter((row) => row.width > 0 && row.height > 0)
      const points: string[] = []
      rows.forEach((row, index) => {
        const x = row.left - bounds.left - gutter + 0.5
        const top = row.top - bounds.top
        const bottom = row.bottom - bounds.top
        points.push(`${index ? "L" : "M"}${x},${top}`, `V${bottom}`)
      })
      setPath(points.join(" "))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(tree)
    tree.addEventListener("toggle", schedule, true)
    window.addEventListener("resize", schedule)
    measure()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      tree.removeEventListener("toggle", schedule, true)
      window.removeEventListener("resize", schedule)
    }
  }, [entries])
  return (
    <div ref={treeRef} className="relative">
      <svg
        data-toc-guide
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute inset-0 size-full overflow-visible text-border/20"
      >
        <path d={path} fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="miter" />
      </svg>
      <ContentsList entries={entries} activeId={activeId} />
    </div>
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
  const [activeId, setActiveId] = useState<string | null>(null)
  const contentsRef = useRef<HTMLElement>(null)
  useEffect(() => setEnhanced(true), [])
  useEffect(() => {
    const contents = contentsRef.current
    if (!contents) return
    const headings = entries
      .map(({ id }) => document.getElementById(id))
      .filter((heading): heading is HTMLElement => heading !== null)
    const scope = contents.closest<HTMLElement>("[data-scroll-header-scope]")
    const header = scope?.querySelector<HTMLElement>(":scope > header")
    let frame = 0
    const update = () => {
      frame = 0
      // Use the same reading line as native fragment landing, including room
      // for navigation that an upward jump reveals.
      const clearance = headings[0]
        ? parseFloat(getComputedStyle(headings[0]).scrollMarginTop) || 0
        : 0
      const readingLine = Math.max(0, header?.getBoundingClientRect().bottom ?? 0, clearance) + 2
      let next = headings[0]?.id ?? null
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > readingLine) break
        next = heading.id
      }
      if (
        window.scrollY > 0 &&
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
      ) {
        next = headings.at(-1)?.id ?? next
      }
      setActiveId((previous) => (previous === next ? previous : next))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    // Passive, one-frame reads also handle native smooth fragment navigation.
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    window.addEventListener("hashchange", schedule)
    scope?.addEventListener("transitionend", schedule)
    const observer = new ResizeObserver(schedule)
    observer.observe(contents)
    observer.observe(document.documentElement)
    update()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      window.removeEventListener("hashchange", schedule)
      scope?.removeEventListener("transitionend", schedule)
    }
  }, [entries])
  const tree = useMemo(() => buildContentsTree(entries), [entries])
  if (!entries.length) return null
  const navigationClassName =
    "max-h-[min(60svh,calc(100svh_-_var(--site-header-offset,6rem)_-_5rem))] overflow-y-auto p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"

  return (
    <aside
      ref={contentsRef}
      data-article-toc
      data-enhanced={enhanced}
      className={cn(
        "z-30 self-start bg-background/95 backdrop-blur data-[enhanced=true]:sticky lg:sticky lg:top-[calc(var(--site-header-offset,6rem)_+_1rem)] lg:bg-transparent lg:backdrop-blur-none print:hidden",
        stickyHeaderOffsetClassNames,
        className
      )}
    >
      <details data-toc-mobile className="group lg:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
          On this page
          <ChevronDown
            className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden
          />
        </summary>
        <nav aria-label="On this page" tabIndex={0} className={navigationClassName}>
          <ContentsTree entries={tree} activeId={activeId} />
        </nav>
      </details>
      <nav
        aria-label="On this page"
        tabIndex={0}
        className={cn(navigationClassName, "hidden lg:block")}
      >
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          On this page
        </p>
        <ContentsTree entries={tree} activeId={activeId} />
      </nav>
    </aside>
  )
}
