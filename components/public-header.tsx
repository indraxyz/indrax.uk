import Link from "next/link"

import { PublicNavigation, type PublicPage } from "@/components/public-navigation"
import { SITE_CONTAINER_CLASS } from "@/components/site-container"
import { ThemeToggle } from "@/components/theme-toggle"

export function PublicHeader({ activePage }: { activePage?: PublicPage | null }) {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85 print:static print:bg-transparent print:backdrop-blur-none">
      <div className={`${SITE_CONTAINER_CLASS} py-4`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            prefetch={false}
            href="/"
            className="text-lg font-black uppercase tracking-tight text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-xl"
          >
            Indra
          </Link>
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <PublicNavigation activePage={activePage} />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}
