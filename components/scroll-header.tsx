import { useEffect, useRef, useState, type ComponentProps } from "react"
import { useLocation } from "react-router"

import { cn } from "@/lib/utils"

/** Shared public/admin header; remains in document flow and reachable by keyboard. */
export function ScrollHeader({
  children,
  className,
  pinned = false,
  ...props
}: ComponentProps<"header"> & { pinned?: boolean }) {
  const headerRef = useRef<HTMLElement>(null)
  const [hidden, setHidden] = useState(false)
  const { key } = useLocation()

  useEffect(() => {
    let previous = window.scrollY
    let anchor = previous
    let direction = 0
    let frame = 0
    setHidden(false)

    const update = () => {
      frame = 0
      const header = headerRef.current
      if (!header) return
      // Clamp elastic overscroll so reaching either boundary cannot flip direction.
      const maximum = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
      const current = Math.max(0, Math.min(window.scrollY, maximum))
      const nextDirection = Math.sign(current - previous)
      if (current <= header.offsetHeight || pinned || header.querySelector(":focus-visible")) {
        setHidden(false)
        anchor = current
        direction = 0
      } else if (nextDirection) {
        if (nextDirection !== direction) anchor = previous
        direction = nextDirection
        // Accumulate movement, ignoring small touchpad/touch direction changes.
        if (Math.abs(current - anchor) >= 12) {
          setHidden(direction > 0)
          anchor = current
        }
      }
      previous = current
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
    }
  }, [key, pinned])

  const isHidden = hidden && !pinned
  return (
    <header
      {...props}
      ref={headerRef}
      data-scroll-hidden={isHidden}
      onFocusCapture={(event) => {
        setHidden(false)
        props.onFocusCapture?.(event)
      }}
      className={cn(
        "sticky top-0 z-50 border-b-2 border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85",
        "transition-transform duration-200 motion-reduce:transition-none has-[:focus-visible]:translate-y-0 print:static print:translate-y-0 print:bg-transparent print:backdrop-blur-none",
        isHidden && "-translate-y-full",
        className
      )}
    >
      {children}
    </header>
  )
}
