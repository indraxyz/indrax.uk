import type { NodeViewRendererProps } from "@tiptap/core"
import type { NodeView } from "@tiptap/pm/view"
import { closeHistory } from "@tiptap/pm/history"
import { contentAlignment } from "./alignment"
import { normalizeYouTubeUrl, videoWidth } from "./video-url"

/** Shared pointer/keyboard resizing; only completed gestures change the document. */
export function resizableMediaView(
  { node: initialNode, editor, getPos }: NodeViewRendererProps,
  kind: "image" | "youtube"
): NodeView {
  const isVideo = kind === "youtube"
  let node = initialNode
  const container = document.createElement("div")
  container.dataset.resizeContainer = ""
  container.dataset.node = kind
  const wrapper = document.createElement("div")
  wrapper.dataset.resizeWrapper = ""
  const media = document.createElement(isVideo ? "iframe" : "img")
  media.draggable = false
  wrapper.appendChild(media)
  container.appendChild(wrapper)
  let drag: { pointer: number; x: number; width: number; ratio: number; sign: number } | null = null

  if (isVideo) {
    wrapper.dataset.youtubeVideo = ""
    media.tabIndex = -1
    media.style.pointerEvents = "none"
    media.setAttribute("loading", "lazy")
    media.setAttribute("referrerpolicy", "strict-origin-when-cross-origin")
    media.setAttribute("allow", "encrypted-media; picture-in-picture; fullscreen")
    media.setAttribute("allowfullscreen", "true")
  }
  const sync = () => {
    const alignment = contentAlignment(node.attrs.textAlign, true)
    if (alignment) container.dataset.align = alignment
    else delete container.dataset.align
    for (const attr of ["src", "alt", "title"] as const) {
      if (node.attrs[attr] == null) media.removeAttribute(attr)
      else if (attr === "src" && isVideo) {
        const src = normalizeYouTubeUrl(String(node.attrs.src))
        if (src && media.getAttribute("src") !== src) media.setAttribute("src", src)
        else if (!src) media.removeAttribute("src")
      } else media.setAttribute(attr, String(node.attrs[attr]))
    }
    if (isVideo) {
      wrapper.style.width =
        node.attrs.fullWidth === true ? "100%" : `${videoWidth(node.attrs.width)}px`
      wrapper.dataset.videoWidth = String(videoWidth(node.attrs.width))
      if (node.attrs.fullWidth === true) wrapper.dataset.fullWidth = "true"
      else delete wrapper.dataset.fullWidth
      if (alignment) wrapper.dataset.align = alignment
      else delete wrapper.dataset.align
    } else {
      // Native dimensions reserve the saved aspect ratio before image bytes
      // arrive; responsive height:auto otherwise collapses an unloaded image.
      for (const dimension of ["width", "height"] as const) {
        const value = Number(node.attrs[dimension])
        if (Number.isFinite(value) && value > 0)
          media.setAttribute(dimension, String(Math.max(1, Math.round(value))))
        else media.removeAttribute(dimension)
      }
      media.style.width = node.attrs.width ? `${node.attrs.width}px` : ""
      media.style.height = node.attrs.height ? `${node.attrs.height}px` : ""
    }
  }
  const measured = isVideo ? wrapper : media
  const dimensions = () => ({ width: measured.offsetWidth, height: measured.offsetHeight })
  const constrain = (width: number, ratio: number) =>
    Math.round(
      Math.min(container.clientWidth, isVideo ? 3840 : Infinity, Math.max(32, 32 * ratio, width))
    )
  const commit = (width: number, height: number) => {
    const pos = getPos()
    if (pos === undefined || editor.isDestroyed) return
    editor.view.dispatch(closeHistory(editor.state.tr))
    editor
      .chain()
      .setNodeSelection(pos)
      .updateAttributes(kind, {
        width,
        height: isVideo ? Math.round((width * 9) / 16) : height,
        ...(isVideo ? { fullWidth: false } : {}),
      })
      .run()
    editor.view.dispatch(closeHistory(editor.state.tr))
  }

  const handles = ["top-left", "top-right", "bottom-left", "bottom-right"].map((direction) => {
    const handle = document.createElement("div")
    handle.dataset.resizeHandle = direction
    handle.tabIndex = 0
    handle.setAttribute("role", "slider")
    handle.setAttribute("aria-label", isVideo ? "Video width" : "Image width")
    handle.setAttribute("aria-orientation", "horizontal")
    handle.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown")
    handle.title = "Drag to resize, or use arrow keys (Shift for larger steps)"
    handle.addEventListener("keydown", (event) => {
      const direction = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key]
      if (!direction) return
      event.preventDefault()
      const size = dimensions()
      if (!size.width || !size.height) return
      const ratio = isVideo ? 16 / 9 : size.width / size.height
      const width = constrain(size.width + direction * (event.shiftKey ? 10 : 1), ratio)
      commit(width, Math.round(width / ratio))
    })
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || drag) return
      const size = dimensions()
      if (!size.width || !size.height) return
      event.preventDefault()
      handle.setPointerCapture(event.pointerId)
      drag = {
        pointer: event.pointerId,
        x: event.clientX,
        width: size.width,
        ratio: isVideo ? 16 / 9 : size.width / size.height,
        sign: direction.endsWith("left") ? -1 : 1,
      }
      container.dataset.resizeState = "true"
    })
    handle.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointer !== event.pointerId) return
      const width = constrain(drag.width + (event.clientX - drag.x) * drag.sign, drag.ratio)
      if (isVideo) wrapper.style.width = `${width}px`
      else {
        media.style.width = `${width}px`
        media.style.height = `${Math.round(width / drag.ratio)}px`
      }
    })
    const finish = (event: PointerEvent) => {
      if (!drag || drag.pointer !== event.pointerId) return
      drag = null
      container.dataset.resizeState = "false"
      if (event.type === "pointerup") {
        const { width, height } = dimensions()
        commit(width, height)
      } else sync()
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
    }
    handle.addEventListener("pointerup", finish)
    handle.addEventListener("pointercancel", finish)
    handle.addEventListener("lostpointercapture", finish)
    wrapper.appendChild(handle)
    return handle
  })
  const observer = new ResizeObserver(() => {
    const { width, height } = dimensions()
    container.toggleAttribute("data-resize-small", width < 88 || height < 88)
    for (const handle of handles) {
      handle.setAttribute("aria-valuemin", String(Math.min(32, width)))
      handle.setAttribute("aria-valuemax", String(container.clientWidth))
      handle.setAttribute("aria-valuenow", String(width))
      handle.setAttribute("aria-valuetext", `${width} pixels wide, ${height} pixels high`)
    }
  })
  observer.observe(measured)
  sync()
  return {
    dom: container,
    update(updatedNode) {
      if (updatedNode.type !== node.type) return false
      node = updatedNode
      sync()
      return true
    },
    stopEvent(event) {
      return (
        event.target instanceof Element && Boolean(event.target.closest("[data-resize-handle]"))
      )
    },
    ignoreMutation() {
      return true
    },
    destroy() {
      observer.disconnect()
      drag = null
    },
  }
}
