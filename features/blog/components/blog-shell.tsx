import type { ReactNode } from "react"

import { PublicFooter } from "@/components/public-footer"
import { PublicHeader } from "@/components/public-header"
import { PublicMain } from "@/components/public-main"

interface BlogShellProps {
  children: ReactNode
  activePage?: "blogs" | null
}

/**
 * The chrome every blog page sits in.
 *
 * Mirrors the public shell rather than inventing a second layout: the same
 * sticky header treatment and container width. A reader moving between home,
 * the resume, and an article should not feel they have left the site.
 *
 * It is a component rather than an `app/blog/layout.tsx` so that `not-found.tsx`
 * at the root can reuse it too - a Next layout would not wrap that.
 */
export function BlogShell({ children, activePage = "blogs" }: BlogShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader activePage={activePage} />

      <PublicMain spaced>{children}</PublicMain>

      <PublicFooter />
    </div>
  )
}
