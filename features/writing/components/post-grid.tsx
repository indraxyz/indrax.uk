import type { ReactNode } from "react"

/** Shared article-card layout for home, archive, search, tags, and related posts. */
export function PostGrid({ children }: { children: ReactNode }) {
  return (
    <div data-post-grid className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  )
}
