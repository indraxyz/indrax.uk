/** Only pagination pushes request focus/scroll; Back keeps normal restoration. */
export function requestsPaginationScroll(state: unknown, target: string, navigation: string) {
  return (
    navigation === "PUSH" &&
    typeof state === "object" &&
    state !== null &&
    "paginationScrollTarget" in state &&
    state.paginationScrollTarget === target
  )
}

export function scrollToPaginationResults(target: HTMLElement) {
  const header = parseFloat(getComputedStyle(target).getPropertyValue("--site-header-height")) || 0
  const toolbar = target.closest("main")?.querySelector("[data-sticky-toolbar]")
  const offset = header + (toolbar?.getBoundingClientRect().height ?? 0) + 16
  const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset)
  target.focus({ preventScroll: true })
  window.scrollTo({
    top,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
  })
}
