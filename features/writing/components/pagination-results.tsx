import { useEffect, useRef, type ReactNode } from "react"
import { useLocation, useNavigationType } from "react-router"
import { cn } from "@/lib/utils"

import {
  requestsPaginationScroll,
  scrollToPaginationResults,
} from "@/features/writing/utils/pagination-scroll"

/** Wait for the destination results before moving keyboard focus and viewport. */
export function PaginationResults({
  id,
  label,
  ready,
  children,
  className,
}: {
  id: string
  label: string
  ready: boolean
  children: ReactNode
  className?: string
}) {
  const target = useRef<HTMLDivElement>(null)
  const handled = useRef<string | null>(null)
  const location = useLocation()
  const navigation = useNavigationType()
  useEffect(() => {
    if (
      !ready ||
      handled.current === location.key ||
      !requestsPaginationScroll(location.state, id, navigation)
    )
      return
    const frame = requestAnimationFrame(() => {
      if (!target.current) return
      handled.current = location.key
      const active = document.activeElement
      // A reader may choose another control while the next page is loading.
      if (active && active !== document.body && !active.closest("[data-pagination-controls]"))
        return
      scrollToPaginationResults(target.current)
    })
    return () => cancelAnimationFrame(frame)
  }, [ready, location.key, location.state, id, navigation])

  return (
    <div
      ref={target}
      id={id}
      role="region"
      aria-label={label}
      tabIndex={-1}
      data-pagination-results
      className={cn("min-w-0 focus:outline-none", className)}
    >
      {children}
    </div>
  )
}
