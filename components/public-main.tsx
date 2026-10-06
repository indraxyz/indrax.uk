import type { ReactNode } from "react"

import { SITE_CONTAINER_CLASS } from "@/components/site-container"

export function PublicMain({
  children,
  spaced = false,
  fullWidth = false,
}: {
  children: ReactNode
  spaced?: boolean
  fullWidth?: boolean
}) {
  return (
    <main
      className={`${fullWidth ? "w-full pb-10 lg:pb-14" : `${SITE_CONTAINER_CLASS} py-10 lg:py-14`} flex-1 print:py-4 ${spaced ? "flex flex-col gap-8" : ""}`}
    >
      {children}
    </main>
  )
}
