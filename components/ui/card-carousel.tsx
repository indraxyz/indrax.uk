import useEmblaCarousel from "embla-carousel-react"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { useEffect, useId, useState, type ReactNode } from "react"

import { controlClassNames } from "@/components/ui/variants"
import { cn } from "@/lib/utils"

/** Enhances a native scrolling rail after hydration; cards keep their own widths. */
export function CardCarousel({ title, children }: { title: string; children: ReactNode }) {
  const viewportId = useId()
  const [viewportRef, api] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    loop: false,
    breakpoints: { "(prefers-reduced-motion: reduce)": { duration: 0 } },
  })
  const [navigation, setNavigation] = useState({ previous: false, next: false })

  useEffect(() => {
    if (!api) return
    const updateNavigation = () =>
      setNavigation({ previous: api.canScrollPrev(), next: api.canScrollNext() })
    updateNavigation()
    api.on("select", updateNavigation).on("reInit", updateNavigation)
    return () => {
      api.off("select", updateNavigation).off("reInit", updateNavigation)
    }
  }, [api])

  return (
    <>
      <div
        id={viewportId}
        ref={viewportRef}
        role="region"
        aria-label={title}
        aria-roledescription="carousel"
        tabIndex={0}
        className={cn(
          "min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
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
      <div
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
          className={cn(controlClassNames, "size-11 justify-center disabled:opacity-40")}
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label={`Next ${title} cards`}
          aria-controls={viewportId}
          disabled={!navigation.next}
          onClick={() => api?.scrollNext()}
          className={cn(controlClassNames, "size-11 justify-center disabled:opacity-40")}
        >
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </>
  )
}
