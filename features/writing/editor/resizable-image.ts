import { Image } from "@tiptap/extension-image"
import { closeHistory } from "@tiptap/pm/history"

/** Tiptap's image schema with pointer/keyboard controls that persist only finished resizes. */
export const ResizableImage = Image.extend({
  addNodeView() {
    return ({ node: initialNode, editor, getPos }) => {
      let node = initialNode
      const container = document.createElement("div")
      container.dataset.resizeContainer = ""
      container.dataset.node = "image"
      const wrapper = document.createElement("div")
      wrapper.dataset.resizeWrapper = ""
      const image = document.createElement("img")
      image.draggable = false
      wrapper.appendChild(image)
      container.appendChild(wrapper)
      let drag: { pointer: number; x: number; width: number; ratio: number; sign: number } | null =
        null

      const sync = () => {
        for (const attr of ["src", "alt", "title"] as const) {
          if (node.attrs[attr] == null) image.removeAttribute(attr)
          else image.setAttribute(attr, String(node.attrs[attr]))
        }
        image.style.width = node.attrs.width ? `${node.attrs.width}px` : ""
        image.style.height = node.attrs.height ? `${node.attrs.height}px` : ""
      }
      const dimensions = () => ({ width: image.offsetWidth, height: image.offsetHeight })
      const constrain = (width: number, ratio: number) =>
        Math.round(Math.min(container.clientWidth, Math.max(32, 32 * ratio, width)))
      const commit = (width: number, height: number) => {
        const pos = getPos()
        if (pos === undefined || editor.isDestroyed) return
        editor.view.dispatch(closeHistory(editor.state.tr))
        editor.chain().setNodeSelection(pos).updateAttributes("image", { width, height }).run()
        editor.view.dispatch(closeHistory(editor.state.tr))
      }

      const handles = ["top-left", "top-right", "bottom-left", "bottom-right"].map((direction) => {
        const handle = document.createElement("div")
        handle.dataset.resizeHandle = direction
        handle.tabIndex = 0
        handle.setAttribute("role", "slider")
        handle.setAttribute("aria-label", "Image width")
        handle.setAttribute("aria-orientation", "horizontal")
        handle.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight ArrowUp ArrowDown")
        handle.title = "Drag to resize, or use arrow keys (Shift for larger steps)"
        handle.addEventListener("keydown", (event) => {
          const direction = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key]
          if (!direction) return
          event.preventDefault()
          const size = dimensions()
          if (!size.width || !size.height) return
          const ratio = size.width / size.height
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
            ratio: size.width / size.height,
            sign: direction.endsWith("left") ? -1 : 1,
          }
          container.dataset.resizeState = "true"
        })
        handle.addEventListener("pointermove", (event) => {
          if (!drag || drag.pointer !== event.pointerId) return
          const width = constrain(drag.width + (event.clientX - drag.x) * drag.sign, drag.ratio)
          image.style.width = `${width}px`
          image.style.height = `${Math.round(width / drag.ratio)}px`
        })
        const finish = (event: PointerEvent) => {
          if (!drag || drag.pointer !== event.pointerId) return
          drag = null
          container.dataset.resizeState = "false"
          if (event.type === "pointerup") {
            const { width, height } = dimensions()
            commit(width, height)
          } else sync()
          if (handle.hasPointerCapture(event.pointerId))
            handle.releasePointerCapture(event.pointerId)
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
      observer.observe(image)
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
  },
})
