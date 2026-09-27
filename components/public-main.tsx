import type { ReactNode } from "react"

import { SITE_CONTAINER_CLASS } from "@/components/site-container"

export function PublicMain({
  children,
  spaced = false,
}: {
  children: ReactNode
  spaced?: boolean
}) {
  return (
    <main
      className={`${SITE_CONTAINER_CLASS} flex-1 py-10 print:py-4 lg:py-14 ${spaced ? "flex flex-col gap-8" : ""}`}
    >
      {children}
    </main>
  )
}
