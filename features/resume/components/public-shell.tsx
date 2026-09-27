import type { ReactNode } from "react"

import { PublicFooter } from "@/components/public-footer"
import { PublicHeader } from "@/components/public-header"
import { PublicMain } from "@/components/public-main"
import type { PublicPage } from "@/components/public-navigation"

export function PublicShell({
  children,
  activePage,
}: {
  children: ReactNode
  activePage: PublicPage
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader activePage={activePage} />

      <PublicMain>{children}</PublicMain>

      <PublicFooter />
    </div>
  )
}
