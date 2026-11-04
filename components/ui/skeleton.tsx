import type { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"

/** Decorative geometry; loading announcements belong to the surrounding group. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      aria-hidden="true"
      data-skeleton
      className={cn("animate-pulse bg-muted-foreground/15 motion-reduce:animate-none", className)}
    />
  )
}

/** Keep the status outside the busy subtree so its announcement is not deferred. */
export function SkeletonContent({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div data-loading-skeleton>
      <p role="status" className="sr-only">
        {label}
      </p>
      <div aria-busy="true">
        <div aria-hidden="true" className={className}>
          {children}
        </div>
      </div>
    </div>
  )
}
