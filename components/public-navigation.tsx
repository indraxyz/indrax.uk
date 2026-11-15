import { NavigationIcon } from "@/components/ui/navigation-icon"
import { Link } from "react-router"

import { navigationLinkClassNames } from "@/components/ui/navigation-link"
import { WRITING_CONFIG } from "@/features/writing/config"
import { cn } from "@/lib/utils"

export type PublicPage = "home" | "resume" | "writing" | "tech-stack"

const LINKS = [
  { to: "/", label: "Home", page: "home" },
  { to: "/resume", label: "Resume", page: "resume" },
  { to: WRITING_CONFIG.basePath, label: WRITING_CONFIG.title, page: "writing" },
  { to: "/tech-stack", label: "Stack", page: "tech-stack" },
] as const

export function PublicNavigation({ activePage }: { activePage?: PublicPage | null }) {
  return (
    <nav aria-label="Site" className="flex max-w-full flex-wrap items-center gap-1 sm:gap-2">
      {LINKS.map(({ to, label, page }) => (
        <Link
          key={page}
          prefetch="none"
          to={to}
          aria-label={label}
          title={label}
          aria-current={activePage === page ? "page" : undefined}
          className={cn(navigationLinkClassNames, "size-11 shrink-0 p-0")}
        >
          <NavigationIcon name={page} active={activePage === page} className="size-5" />
        </Link>
      ))}
    </nav>
  )
}
