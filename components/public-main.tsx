import type { ReactNode } from "react"

import { SITE_CONTAINER_CLASS } from "@/components/site-container"

export function PublicMain({
  children,
  fullWidth = false,
}: {
  children: ReactNode
  fullWidth?: boolean
}) {
  return (
    <main
      className={`${fullWidth ? "w-full pb-10 lg:pb-14" : `${SITE_CONTAINER_CLASS} py-10 lg:py-14`} flex-1 print:py-4`}
    >
      {children}
    </main>
  )
}
