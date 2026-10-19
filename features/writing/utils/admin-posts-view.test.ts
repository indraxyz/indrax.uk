import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  ADMIN_POSTS_VIEW_CHANGE_EVENT,
  ADMIN_POSTS_VIEW_STORAGE_KEY,
  readAdminPostsView,
  subscribeToAdminPostsView,
  writeAdminPostsView,
} from "./admin-posts-view"

let stored: Map<string, string>
let events: EventTarget

beforeEach(() => {
  stored = new Map()
  events = new EventTarget()
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
  })
})
afterEach(() => vi.unstubAllGlobals())

describe("admin posts view preference", () => {
  it("defaults to cards and ignores unknown stored values", () => {
    expect(readAdminPostsView()).toBe("cards")
    stored.set(ADMIN_POSTS_VIEW_STORAGE_KEY, "grid")
    expect(readAdminPostsView()).toBe("cards")
  })

  it("remembers the choice and notifies subscribers in this tab", () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToAdminPostsView(listener)
    writeAdminPostsView("table")
    expect(stored.get(ADMIN_POSTS_VIEW_STORAGE_KEY)).toBe("table")
    expect(readAdminPostsView()).toBe("table")
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    writeAdminPostsView("cards")
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("follows changes made in another tab", () => {
    const listener = vi.fn()
    subscribeToAdminPostsView(listener)
    events.dispatchEvent(new Event("storage"))
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("keeps working when storage is unavailable", () => {
    const blocked = () => {
      throw new DOMException("blocked", "SecurityError")
    }
    window.localStorage.getItem = blocked
    window.localStorage.setItem = blocked
    const listener = vi.fn()
    events.addEventListener(ADMIN_POSTS_VIEW_CHANGE_EVENT, listener)

    expect(readAdminPostsView()).toBe("cards")
    expect(() => writeAdminPostsView("table")).not.toThrow()
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
