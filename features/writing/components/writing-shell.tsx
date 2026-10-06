import type { ReactNode } from "react"

import type { BreadcrumbItem } from "@/components/ui/breadcrumb"
import { PublicShell } from "@/features/resume/components/public-shell"
import { WRITING_CONFIG } from "@/features/writing/config"

interface WritingShellProps {
  children: ReactNode
  activePage?: "writing" | null
  breadcrumbs?: readonly BreadcrumbItem[]
}

/** All reading routes share the public layout and breadcrumb navigation. */
export function WritingShell({ children, activePage = "writing", breadcrumbs }: WritingShellProps) {
  return (
    <PublicShell
      activePage={activePage}
      breadcrumbs={
        breadcrumbs ??
        (activePage
          ? [
              { name: "Home", path: "/" },
              { name: WRITING_CONFIG.title, path: WRITING_CONFIG.basePath },
            ]
          : [{ name: "Home", path: "/" }, { name: "Not found" }])
      }
    >
      <div className="space-y-8">{children}</div>
    </PublicShell>
  )
}
