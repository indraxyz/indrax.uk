import { Copyright } from "lucide-react"

import { ConsentControl } from "@/components/consent-banner"
import { SITE_CONTAINER_CLASS } from "@/components/site-container"
import { ThemeToggle } from "@/components/theme-toggle"

export function PublicFooter() {
  return (
    <footer className={SITE_CONTAINER_CLASS}>
      <div className="mt-12 flex items-center justify-between gap-3 border-t-2 border-border py-10 print:mt-4 print:py-3">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Copyright className="size-3.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="sr-only">© </span>
            {new Date().getFullYear()} by <strong className="font-bold">Indra</strong>
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-2 print:hidden">
          <ConsentControl />
          <ThemeToggle />
        </div>
      </div>
    </footer>
  )
}
