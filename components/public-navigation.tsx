import { BookOpenText, FileUser, House, Layers } from "lucide-react"
import { Link } from "react-router"

import { navigationLinkClassNames } from "@/components/ui/navigation-link"
import { WRITING_CONFIG } from "@/features/writing/config"
import { cn } from "@/lib/utils"

export type PublicPage = "home" | "resume" | "writing" | "tech-stack"

const LINKS = [
  { to: "/", label: "Home", page: "home", icon: House },
  { to: "/resume", label: "Resume", page: "resume", icon: FileUser },
  { to: WRITING_CONFIG.basePath, label: WRITING_CONFIG.title, page: "writing", icon: BookOpenText },
  { to: "/tech-stack", label: "Stack", page: "tech-stack", icon: Layers },
] as const

export function PublicNavigation({ activePage }: { activePage?: PublicPage | null }) {
  return (
    <nav aria-label="Site" className="flex max-w-full flex-wrap items-center gap-1 sm:gap-2">
      {LINKS.map(({ to, label, page, icon: Icon }) => (
        <Link
          key={page}
          prefetch="none"
          to={to}
          aria-label={label}
          title={label}
          aria-current={activePage === page ? "page" : undefined}
          className={cn(navigationLinkClassNames, "size-11 shrink-0 p-0")}
        >
          <Icon className="size-4" aria-hidden />
        </Link>
      ))}
    </nav>
  )
}
