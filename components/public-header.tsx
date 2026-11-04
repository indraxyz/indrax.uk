import { Link } from "react-router"

import { PublicNavigation, type PublicPage } from "@/components/public-navigation"
import { focusControlClassNames } from "@/components/ui/variants"
import { cn } from "@/lib/utils"
import { SITE_CONTAINER_CLASS } from "@/components/site-container"
import { ScrollHeader } from "@/components/scroll-header"

export function PublicHeader({ activePage }: { activePage?: PublicPage | null }) {
  return (
    <ScrollHeader>
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
    </ScrollHeader>
  )
}
