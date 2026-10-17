import { House } from "lucide-react"
import { Link } from "react-router"

import { navigationLinkClassNames } from "@/components/ui/navigation-link"
import { WRITING_CONFIG } from "@/features/writing/config"

export type PublicPage = "home" | "resume" | "writing" | "tech-stack"

export function PublicNavigation({ activePage }: { activePage?: PublicPage | null }) {
  return (
    <nav aria-label="Site" className="flex items-center gap-1 sm:gap-2">
      <Link
        prefetch="none"
        to="/"
        aria-label="Home"
        title="Home"
        aria-current={activePage === "home" ? "page" : undefined}
        className={navigationLinkClassNames}
      >
        <House className="h-4 w-4" aria-hidden />
      </Link>
      <Link
        prefetch="none"
        to="/resume"
        aria-current={activePage === "resume" ? "page" : undefined}
        className={navigationLinkClassNames}
      >
        Resume
      </Link>
      <Link
        prefetch="none"
        to={WRITING_CONFIG.basePath}
        aria-current={activePage === "writing" ? "page" : undefined}
        className={navigationLinkClassNames}
      >
        {WRITING_CONFIG.title}
      </Link>
      <Link
        prefetch="none"
        to="/tech-stack"
        aria-current={activePage === "tech-stack" ? "page" : undefined}
        className={navigationLinkClassNames}
      >
        Stack
      </Link>
    </nav>
  )
}
