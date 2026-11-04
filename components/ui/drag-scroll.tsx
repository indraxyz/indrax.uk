import { useEffect, useId, useRef, useState, type ComponentProps } from "react"

import { cn } from "@/lib/utils"

interface DragGesture {
  pointerId: number
  x: number
  y: number
  scrollLeft: number
  dragging: boolean
}

/** Native touch/keyboard scrolling with mouse/pen dragging and visible overflow cues. */
export function DragScroll({ children, className, ...props }: ComponentProps<"div">) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<DragGesture | null>(null)
  const suppressClick = useRef(false)
  const instructionsId = useId()
  const [dragging, setDragging] = useState(false)
  const [overflow, setOverflow] = useState({ left: false, right: false })
  const canDrag = overflow.left || overflow.right

  useEffect(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport || !track) return
    const updateOverflow = () => {
      const left = viewport.scrollLeft > 1
      const right = viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1
      setOverflow((current) => {
        return current.left === left && current.right === right ? current : { left, right }
      })
    }
    updateOverflow()
    const observer = new ResizeObserver(updateOverflow)
    observer.observe(viewport)
    observer.observe(track)
    viewport.addEventListener("scroll", updateOverflow, { passive: true })

    const move = (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture || event.pointerId !== gesture.pointerId) return
      const horizontal = event.clientX - gesture.x
      const vertical = event.clientY - gesture.y
      if (!gesture.dragging) {
        if (Math.abs(vertical) > 6 && Math.abs(vertical) > Math.abs(horizontal)) {
          gestureRef.current = null
          return
        }
        if (Math.abs(horizontal) < 6) return
        gesture.dragging = true
        suppressClick.current = true
        viewport.setPointerCapture(event.pointerId)
        setDragging(true)
      }
      event.preventDefault()
      viewport.scrollLeft = gesture.scrollLeft - horizontal
    }
    const finish = (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture || gesture.pointerId !== event.pointerId) return
      gestureRef.current = null
      setDragging(false)
      if (viewport.hasPointerCapture(event.pointerId))
        viewport.releasePointerCapture(event.pointerId)
    }
    window.addEventListener("pointermove", move, { passive: false })
    window.addEventListener("pointerup", finish)
    window.addEventListener("pointercancel", finish)
    viewport.addEventListener("lostpointercapture", finish)
    return () => {
      observer.disconnect()
      viewport.removeEventListener("scroll", updateOverflow)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", finish)
      window.removeEventListener("pointercancel", finish)
      viewport.removeEventListener("lostpointercapture", finish)
      const pointerId = gestureRef.current?.pointerId
      if (pointerId !== undefined && viewport.hasPointerCapture(pointerId))
        viewport.releasePointerCapture(pointerId)
      gestureRef.current = null
    }
  }, [])

  return (
    <div className="relative min-w-0" data-drag-scroll>
      <div
        {...props}
        ref={viewportRef}
        tabIndex={props.tabIndex ?? 0}
        aria-describedby={[props["aria-describedby"], instructionsId].filter(Boolean).join(" ")}
        data-dragging={dragging}
        className={cn(
          "min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          "[&_button:enabled]:cursor-pointer data-[dragging=true]:[&_*]:cursor-grabbing",
          canDrag && "cursor-grab",
          dragging && "cursor-grabbing",
          className
        )}
        onPointerDown={(event) => {
          props.onPointerDown?.(event)
          if (event.defaultPrevented || event.button !== 0 || event.pointerType === "touch") return
          const target = event.target as Element
          if (target.closest("input, select, textarea, [contenteditable], [data-no-drag-scroll]"))
            return
          suppressClick.current = false
          if (!canDrag) return
          gestureRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            scrollLeft: event.currentTarget.scrollLeft,
            dragging: false,
          }
        }}
        onClickCapture={(event) => {
          if (suppressClick.current && event.detail > 0) {
            suppressClick.current = false
            event.preventDefault()
            event.stopPropagation()
            return
          }
          props.onClickCapture?.(event)
        }}
        onDragStart={(event) => {
          event.preventDefault()
          props.onDragStart?.(event)
        }}
        onKeyDown={(event) => {
          props.onKeyDown?.(event)
          if (
            event.defaultPrevented ||
            event.target !== event.currentTarget ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey
          )
            return
          const viewport = event.currentTarget
          if (event.key === "ArrowLeft") viewport.scrollLeft -= 120
          else if (event.key === "ArrowRight") viewport.scrollLeft += 120
          else if (event.key === "Home") viewport.scrollLeft = 0
          else if (event.key === "End") viewport.scrollLeft = viewport.scrollWidth
          else return
          event.preventDefault()
        }}
      >
        <div ref={trackRef} className="flex w-max min-w-full select-none flex-nowrap gap-1 p-2">
          {children}
        </div>
      </div>
      <span
        aria-hidden="true"
        data-scroll-cue="left"
        hidden={!overflow.left}
        className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-linear-to-r from-[var(--color-muted)] to-transparent"
      />
      <span
        aria-hidden="true"
        data-scroll-cue="right"
        hidden={!overflow.right}
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-[var(--color-muted)] to-transparent"
      />
      <span id={instructionsId} className="sr-only">
        Scroll horizontally to see more controls. When this toolbar is focused, use Left and Right
        arrow keys, Home or End.
      </span>
    </div>
  )
}
