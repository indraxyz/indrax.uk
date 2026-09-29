"use client"

import { useEffect } from "react"

/**
 * Adds a copy button to every code block, after the page has loaded.
 *
 * The buttons are created here rather than rendered server-side, and that is the
 * point: the article's HTML stays exactly what it was, so a reader with
 * JavaScript disabled sees no dead controls and the zero-JavaScript reading path
 * is unchanged. This is progressive enhancement in the original sense - the page
 * works, and then it gets slightly nicer.
 *
 * The seeded article calls this out as costing "a few bytes". It does, and this
 * is all of them: no library, no per-block React tree, one delegated listener.
 */
export function CopyCode() {
  useEffect(() => {
    const blocks = document.querySelectorAll<HTMLPreElement>(".prose pre")
    const cleanups: (() => void)[] = []

    for (const block of blocks) {
      if (block.dataset.copyAttached) continue
      block.dataset.copyAttached = "true"

      const button = document.createElement("button")
      button.type = "button"
      button.textContent = "Copy"
      button.className =
        "absolute right-2 top-2 border-2 border-border bg-background px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"

      const reset = () => {
        button.textContent = "Copy"
      }

      const onClick = async () => {
        const code = block.querySelector("code")?.textContent ?? ""

        try {
          await navigator.clipboard.writeText(code)
          button.textContent = "Copied"
        } catch {
          // Clipboard access can be refused, and there is nothing useful to do
          // about it beyond not pretending it worked.
          button.textContent = "Press Ctrl+C"
        }

        window.setTimeout(reset, 2000)
      }

      button.addEventListener("click", onClick)

      // The wrapper is what the button is positioned against, and what the hover
      // state keys off. `figure` is what rehype-pretty-code already wraps in.
      const wrapper = block.closest("figure") ?? block.parentElement
      wrapper?.classList.add("group", "relative")
      wrapper?.appendChild(button)

      cleanups.push(() => {
        button.removeEventListener("click", onClick)
        button.remove()
        delete block.dataset.copyAttached
      })
    }

    return () => {
      for (const cleanup of cleanups) cleanup()
    }
  }, [])

  return null
}
