import useEmblaCarousel from "embla-carousel-react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useEffect, useId, useRef, useState, type ReactNode } from "react"

import { controlClassNames } from "@/components/ui/variants"
import { cn } from "@/lib/utils"

/** Enhances a native scrolling rail after hydration; cards keep their own widths. */
export function CardCarousel({
  title,
  children,
  fullBleed = false,
}: {
  title: string
  children: ReactNode
  fullBleed?: boolean
}) {
  const viewportId = useId()
  const navigationRef = useRef<HTMLDivElement>(null)
  const [fitsLayout, setFitsLayout] = useState(false)
  const [viewportRef, api] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    loop: false,
    breakpoints: { "(prefers-reduced-motion: reduce)": { duration: 0 } },
  })
  const [navigation, setNavigation] = useState({ previous: false, next: false })
  const draggable = navigation.previous || navigation.next

  useEffect(() => {
    if (!api) return
    const updateNavigation = () =>
      setNavigation({ previous: api.canScrollPrev(), next: api.canScrollNext() })
    const updateLayout = () => {
      const controls = navigationRef.current
      if (!fullBleed || !controls) return
      const slides = api.slideNodes()
      const first = slides[0]?.getBoundingClientRect()
      const last = slides.at(-1)?.getBoundingClientRect()
      const style = getComputedStyle(controls)
      const available =
        controls.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      // Measure the cards against the independent page-width controls, so changing
      // the viewport inset cannot oscillate between fitting and overflowing.
      setFitsLayout(Boolean(first && last && last.right - first.left <= available + 1))
    }
    // Embla already watches viewport, slide size and slide-list changes.
    updateNavigation()
    updateLayout()
    api.on("select", updateNavigation).on("reInit", updateNavigation).on("reInit", updateLayout)
    return () => {
      api
        .off("select", updateNavigation)
        .off("reInit", updateNavigation)
        .off("reInit", updateLayout)
    }
  }, [api, fullBleed])

  return (
    <>
      <div
        className={cn(
          fullBleed && fitsLayout && "mx-auto max-w-[90rem] px-4 print:max-w-none print:px-0"
        )}
      >
        <div
          id={viewportId}
          ref={viewportRef}
          role="region"
          aria-label={title}
          aria-roledescription="carousel"
          tabIndex={0}
          className={cn(
            "min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
            "[&_a]:cursor-pointer [&_button:enabled]:cursor-pointer",
            draggable && "cursor-grab active:cursor-grabbing",
            api ? "overflow-hidden" : "overflow-x-auto"
          )}
          onKeyDown={(event) => {
            // Nested card panes retain their own scrolling and editing keys.
            if (!api || event.target !== event.currentTarget) return
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
            event.preventDefault()
            if (event.key === "ArrowLeft") api.scrollPrev()
            if (event.key === "ArrowRight") api.scrollNext()
            if (event.key === "Home") api.scrollTo(0)
            if (event.key === "End") api.scrollTo(api.scrollSnapList().length - 1)
          }}
        >
          <div className="flex touch-pan-y touch-pinch-zoom gap-6" data-print-columns>
            {children}
          </div>
        </div>
      </div>
      <div
        ref={navigationRef}
        className={cn(
          "mx-auto mt-4 flex max-w-[90rem] justify-end gap-2 px-4 print:hidden",
          !api && "invisible"
        )}
        role="group"
        aria-label={`${title} carousel navigation`}
      >
        <button
          type="button"
          aria-label={`Previous ${title} cards`}
          aria-controls={viewportId}
          disabled={!navigation.previous}
          onClick={() => api?.scrollPrev()}
          className={cn(
            controlClassNames,
            "size-11 cursor-pointer justify-center disabled:cursor-default disabled:opacity-40"
          )}
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Next ${title} cards`}
          aria-controls={viewportId}
          disabled={!navigation.next}
          onClick={() => api?.scrollNext()}
          className={cn(
            controlClassNames,
            "size-11 cursor-pointer justify-center disabled:cursor-default disabled:opacity-40"
          )}
        >
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </>
  )
}
