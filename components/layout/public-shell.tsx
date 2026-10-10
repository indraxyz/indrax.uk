import type { ReactNode } from "react"

import { PublicFooter } from "@/components/public-footer"
import { PublicHeader } from "@/components/public-header"
import { PublicMain } from "@/components/public-main"
import type { PublicPage } from "@/components/public-navigation"
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"

export function PublicShell({
  children,
  activePage,
  breadcrumbs,
  fullWidth = false,
  className,
}: {
  children: ReactNode
  activePage: PublicPage | null
  breadcrumbs?: readonly BreadcrumbItem[]
  fullWidth?: boolean
  className?: string
}) {
  const trail =
    breadcrumbs ??
    (activePage === "resume" || activePage === "tech-stack"
      ? [{ name: "Home", path: "/" }, { name: activePage === "resume" ? "Resume" : "Stack" }]
      : [])
  return (
    <div className={cn("flex min-h-screen flex-col bg-background", className)}>
      <PublicHeader activePage={activePage} />

      <PublicMain fullWidth={fullWidth}>
        <Breadcrumb items={trail} />
        {children}
      </PublicMain>

      <PublicFooter />
    </div>
  )
}
