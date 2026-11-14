import { afterEach, expect, it, vi } from "vitest"
import { createAdminPreferences, ADMIN_POSTS_VIEW_STORAGE_KEY } from "./admin-preferences"

afterEach(() => vi.unstubAllGlobals())
it("seeds independent stores from validated storage and synchronizes cross-tab changes", () => {
  let value: string | null = "table"
  const target = new EventTarget()
  vi.stubGlobal("window", {
    localStorage: {
      getItem: () => value,
      setItem: (_: string, next: string) => {
        value = next
      },
    },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  })
  const preferences = createAdminPreferences()
  expect(preferences.store.getState().postsView).toBe("table")
  const listener = vi.fn()
  const unsubscribe = preferences.subscribe(listener)
  value = "cards"
  target.dispatchEvent(Object.assign(new Event("storage"), { key: "unrelated" }))
  expect(preferences.store.getState().postsView).toBe("table")
  target.dispatchEvent(Object.assign(new Event("storage"), { key: ADMIN_POSTS_VIEW_STORAGE_KEY }))
  expect(preferences.store.getState().postsView).toBe("cards")
  expect(listener).toHaveBeenCalledTimes(1)
  unsubscribe()
  value = "table"
  target.dispatchEvent(Object.assign(new Event("storage"), { key: null }))
  expect(preferences.store.getState().postsView).toBe("cards")
  expect(createAdminPreferences().store.getState().postsView).toBe("table")
})
