import { afterEach, expect, it, vi } from "vitest"
import { requestsPaginationScroll, scrollToPaginationResults } from "./pagination-scroll"

afterEach(() => vi.unstubAllGlobals())

it("only scrolls a matching pagination push, preserving Back/Forward restoration", () => {
  const state = { paginationScrollTarget: "results" }
  expect(requestsPaginationScroll(state, "results", "PUSH")).toBe(true)
  expect(requestsPaginationScroll(state, "other", "PUSH")).toBe(false)
  for (const navigation of ["POP", "REPLACE"])
    expect(requestsPaginationScroll(state, "results", navigation)).toBe(false)
  for (const value of [null, undefined, "results", {}, { paginationScrollTarget: false }])
    expect(requestsPaginationScroll(value, "results", "PUSH")).toBe(false)
})

it.each([false, true])("reserves sticky controls and honors reduced motion=%s", (reduced) => {
  const scrollTo = vi.fn()
  const focus = vi.fn()
  vi.stubGlobal("window", {
    scrollY: 900,
    matchMedia: () => ({ matches: reduced }),
    scrollTo,
  })
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => "80px" }))
  const target = {
    focus,
    getBoundingClientRect: () => ({ top: 300 }),
    closest: () => ({
      querySelector: () => ({ getBoundingClientRect: () => ({ height: 64 }) }),
    }),
  }
  scrollToPaginationResults(target as unknown as HTMLElement)
  expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  expect(scrollTo).toHaveBeenCalledWith({ top: 1040, behavior: reduced ? "instant" : "smooth" })
})
