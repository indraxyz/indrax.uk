import { useEffect } from "react"

/** Progressive enhancement for React images, sanitized HTML and editor/portal images alike. */
export function ImageLoadingEffects() {
  useEffect(() => enhanceImageLoading(document.body), [])
  return null
}

/** Keep native sources, dimensions and alt text; never request a second preview image. */
export function enhanceImageLoading(root: HTMLElement) {
  const versions = new WeakMap<HTMLImageElement, number>()
  const managed = new Set<HTMLImageElement>()
  let active = true

  const eligible = (image: HTMLImageElement) =>
    image.getAttribute("aria-hidden") !== "true" && Boolean(image.getAttribute("src"))

  const complete = (image: HTMLImageElement) => {
    if (!eligible(image)) return
    const version = versions.get(image) ?? 0
    const source = image.getAttribute("src")
    const settle = () => {
      if (!active || versions.get(image) !== version || image.getAttribute("src") !== source) return
      image.dataset.imageState = image.naturalWidth > 0 ? "ready" : "error"
    }
    // A successful network load can precede decode. Decode failure still exposes
    // native alt/broken-image feedback instead of leaving a permanently blurred box.
    if (image.naturalWidth > 0 && typeof image.decode === "function") {
      void image.decode().then(settle, settle)
    } else settle()
  }

  const track = (image: HTMLImageElement) => {
    if (!eligible(image)) return
    versions.set(image, (versions.get(image) ?? 0) + 1)
    managed.add(image)
    if (image.complete && image.naturalWidth > 0) {
      // Cached images stay sharp: avoid flashing a loading treatment on mount.
      image.dataset.imageState = "ready"
    } else if (image.complete) {
      image.dataset.imageState = "error"
    } else {
      image.dataset.imageState = "loading"
    }
  }
  const scan = (node: Node) => {
    if (node instanceof HTMLImageElement) track(node)
    if (node instanceof Element) node.querySelectorAll("img").forEach(track)
  }
  const onLoad = (event: Event) => {
    if (event.target instanceof HTMLImageElement) complete(event.target)
  }
  const onError = (event: Event) => {
    if (event.target instanceof HTMLImageElement && eligible(event.target)) {
      versions.set(event.target, (versions.get(event.target) ?? 0) + 1)
      event.target.dataset.imageState = "error"
    }
  }
  scan(root)
  // Image load/error do not bubble; capture also covers portalled previews and
  // Tiptap node views without duplicating their rendering or event handlers.
  root.addEventListener("load", onLoad, true)
  root.addEventListener("error", onError, true)
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes" && record.target instanceof HTMLImageElement) {
        track(record.target)
      } else {
        record.addedNodes.forEach(scan)
        for (const removed of record.removedNodes) {
          const forget = (image: HTMLImageElement) => {
            managed.delete(image)
            versions.delete(image)
          }
          if (removed instanceof HTMLImageElement) forget(removed)
          if (removed instanceof Element) removed.querySelectorAll("img").forEach(forget)
        }
      }
    }
  })
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "srcset"],
  })
  return () => {
    active = false
    observer.disconnect()
    root.removeEventListener("load", onLoad, true)
    root.removeEventListener("error", onError, true)
    for (const image of managed) delete image.dataset.imageState
    managed.clear()
  }
}
