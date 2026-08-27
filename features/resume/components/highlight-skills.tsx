"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { Badge, badgeVariants } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// Below `md` the hero only has room for a handful of chips, so the rest collapse
// behind a "N+" trigger. From `md` up every skill is listed inline.
const MOBILE_VISIBLE_COUNT = 5

// Leaving the trigger unmounts the popover, so a short grace period lets the
// pointer cross the gap between the trigger and the panel without it closing.
const HOVER_CLOSE_DELAY_MS = 140

const chipClassName = "variant-primary variant-soft-chip px-3 py-1 text-xs shadow-none"

interface HighlightSkillsProps {
  skills: string[]
  className?: string
}

export function HighlightSkills({ skills, className }: HighlightSkillsProps) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHovered = useRef(false)

  const cancelScheduledClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  // Touch taps also emit pointerenter, which would fight the trigger's own click
  // toggle, so hover is limited to a real mouse.
  const openOnHover = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType !== "mouse") return
      isHovered.current = true
      cancelScheduledClose()
      setOpen(true)
    },
    [cancelScheduledClose]
  )

  const closeOnHoverEnd = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType !== "mouse") return
      isHovered.current = false
      cancelScheduledClose()
      closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS)
    },
    [cancelScheduledClose]
  )

  useEffect(() => cancelScheduledClose, [cancelScheduledClose])

  const visible = skills.slice(0, MOBILE_VISIBLE_COUNT)
  const collapsed = skills.slice(MOBILE_VISIBLE_COUNT)

  return (
    <div className={cn("flex flex-wrap justify-center gap-2 xl:justify-start", className)}>
      {visible.map((skill) => (
        <Badge variant="primary" className={chipClassName} key={skill}>
          {skill}
        </Badge>
      ))}

      {collapsed.map((skill) => (
        <Badge variant="primary" className={cn(chipClassName, "hidden md:inline-flex")} key={skill}>
          {skill}
        </Badge>
      ))}

      {collapsed.length > 0 && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            aria-label={`Show ${collapsed.length} more skills`}
            className={cn(
              badgeVariants({ variant: "primary" }),
              chipClassName,
              "cursor-pointer tracking-[0.12em] md:hidden",
              open
                ? "bg-[var(--variant-bg)] text-[var(--variant-fg)]"
                : "hover:bg-[var(--variant-bg)] hover:text-[var(--variant-fg)]"
            )}
            onPointerEnter={openOnHover}
            onPointerLeave={closeOnHoverEnd}
            // Hover has already opened the panel, so swallow the trigger's toggle
            // to stop a mouse click from immediately closing it again. Radix skips
            // its own handler once the event is default-prevented, which leaves
            // touch taps and keyboard activation toggling as usual.
            onClick={(event) => {
              if (isHovered.current) event.preventDefault()
            }}
          >
            {collapsed.length}+
          </PopoverTrigger>
          <PopoverContent
            align="center"
            className="variant-primary w-auto p-3"
            // The panel holds no interactive content, so keep focus on the trigger
            // instead of yanking it away on hover.
            onOpenAutoFocus={(event) => event.preventDefault()}
            onPointerEnter={openOnHover}
            onPointerLeave={closeOnHoverEnd}
          >
            <ul className="flex flex-col items-start gap-2">
              {collapsed.map((skill) => (
                <li key={skill}>
                  <Badge variant="primary" className={chipClassName}>
                    {skill}
                  </Badge>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
