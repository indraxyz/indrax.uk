import { ArrowLeft, Rss } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { ConsentControl } from "@/components/consent-banner"
import { ThemeToggle } from "@/components/theme-toggle"
import { BLOG_CONFIG } from "@/features/blog/config"
import { RESUME_CONFIG, SITE_HOST } from "@/features/resume/config"

interface BlogShellProps {
  children: ReactNode
}

/**
 * The chrome every blog page sits in.
 *
 * Mirrors `resume-page.tsx` rather than inventing a second layout: the same
 * sticky header treatment, the same container width, the same footer credit. A
 * reader moving between the resume and an article should not feel they have left
 * the site.
 *
 * It is a component rather than an `app/blog/layout.tsx` so that `not-found.tsx`
 * at the root can reuse it too - a Next layout would not wrap that.
 */
export function BlogShell({ children }: BlogShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b-2 border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85 print:static print:bg-transparent print:backdrop-blur-none">
        <div className="container mx-auto max-w-5xl px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-lg font-black uppercase tracking-tight text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-xl"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {RESUME_CONFIG.title}
            </Link>

            <div className="flex items-center gap-2 print:hidden">
              {/* A plain anchor, not `next/link`: the feed is a route handler, not a
                  page, and Link would try to prefetch it as an RSC payload. */}
              <a
                href={BLOG_CONFIG.feedPath}
                className="flex h-9 w-9 items-center justify-center border-2 border-border transition-colors hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="RSS feed"
              >
                <Rss className="h-4 w-4" aria-hidden />
              </a>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl space-y-8 px-4 py-10 print:py-4 lg:py-14">
        {children}
      </main>

      <footer className="container mx-auto max-w-5xl px-4">
        <div className="mt-12 flex items-center justify-center gap-3 border-t-2 border-border py-10 text-center print:mt-4 print:py-3">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">
            {SITE_HOST}
          </p>
          <ConsentControl />
        </div>
      </footer>
    </div>
  )
}
