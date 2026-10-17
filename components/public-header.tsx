import { Link } from "react-router"

import { PublicNavigation, type PublicPage } from "@/components/public-navigation"
import { focusControlClassNames } from "@/components/ui/variants"
import { cn } from "@/lib/utils"
import { SITE_CONTAINER_CLASS } from "@/components/site-container"

export function PublicHeader({ activePage }: { activePage?: PublicPage | null }) {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85 print:static print:bg-transparent print:backdrop-blur-none">
      <div className={`${SITE_CONTAINER_CLASS} py-4`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            prefetch="none"
            to="/"
            className={cn(
              "text-lg font-black uppercase tracking-tight text-foreground hover:underline sm:text-xl",
              focusControlClassNames
            )}
          >
            Indra
          </Link>
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <PublicNavigation activePage={activePage} />
          </div>
        </div>
      </div>
    </header>
  )
}
