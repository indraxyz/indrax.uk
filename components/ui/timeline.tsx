import * as React from "react"
import { cn } from "@/lib/utils"

type TimelineProps = React.HTMLAttributes<HTMLDivElement>

const Timeline = React.forwardRef<HTMLDivElement, TimelineProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("relative space-y-8 print:space-y-4", className)} {...props}>
        {children}
      </div>
    )
  }
)
Timeline.displayName = "Timeline"

interface TimelineItemProps extends React.HTMLAttributes<HTMLDivElement> {
  isLast?: boolean
}

const TimelineItem = React.forwardRef<HTMLDivElement, TimelineItemProps>(
  ({ className, children, isLast = false, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("relative flex gap-4 print:gap-2", className)} {...props}>
        <div className="relative flex w-8 shrink-0 flex-col items-center">
          <div className="variant-primary flex h-8 w-8 items-center justify-center rounded-none border-2 border-[var(--semantic-border-strong)] bg-[var(--variant-soft)] shadow-soft-sm">
            <div className="h-2.5 w-2.5 rounded-none bg-[var(--variant-bg)]" />
          </div>
          {!isLast && (
            <div className="absolute top-8 -bottom-8 left-1/2 w-0.5 -translate-x-1/2 bg-border" />
          )}
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    )
  }
)
TimelineItem.displayName = "TimelineItem"

const TimelineContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn("space-y-1", className)} {...props} />
  }
)
TimelineContent.displayName = "TimelineContent"

export { Timeline, TimelineItem, TimelineContent }
