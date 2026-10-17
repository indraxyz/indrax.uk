import { useEffect, useRef, type ComponentProps } from "react"

import { cn } from "@/lib/utils"

/** Keep list actions below the site header, including when its navigation wraps. */
export function StickyToolbar({ className, children, ...props }: ComponentProps<"div">) {
  const toolbar = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const header = document.querySelector("header")
    if (!header) return
    const update = () => {
      const element = toolbar.current
      if (!element) return
      const bounds = element.getBoundingClientRect()
      element.style.setProperty("--toolbar-top", `${header.getBoundingClientRect().height}px`)
      // Use the layout viewport to avoid scrollbar-width overflow from 100vw.
      element.style.setProperty("--toolbar-bleed-left", `${-bounds.left}px`)
      element.style.setProperty(
        "--toolbar-bleed-right",
        `${bounds.right - document.documentElement.clientWidth}px`
      )
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(header)
    observer.observe(document.documentElement)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={toolbar}
      data-sticky-toolbar
      className={cn("sticky top-[var(--toolbar-top,6rem)] z-30 py-3 print:static", className)}
      {...props}
    >
      <span
        aria-hidden="true"
        data-sticky-toolbar-surface
        className="pointer-events-none absolute inset-y-0 -z-10 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85 print:hidden"
        style={{ left: "var(--toolbar-bleed-left, 0px)", right: "var(--toolbar-bleed-right, 0px)" }}
      />
      {children}
    </div>
  )
}
