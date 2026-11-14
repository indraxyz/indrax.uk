import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { createDisplayPreference } from "./client-preference"
import { clearConsent, readConsent, subscribeToConsent, writeConsent } from "./consent"
import { readTheme, writeTheme } from "./theme"

let stored: Map<string, string>
let target: EventTarget
beforeEach(() => {
  stored = new Map()
  target = new EventTarget()
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  })
})
afterEach(() => vi.unstubAllGlobals())
const change = (key: string | null) =>
  target.dispatchEvent(Object.assign(new Event("storage"), { key }))
const blocked = () => {
  throw new Error("blocked")
}

it("filters cross-tab changes, observes clear/removal and cleans up consent listeners", () => {
  const listener = vi.fn()
  const unsubscribe = subscribeToConsent(listener)
  change("unrelated")
  target.dispatchEvent(
    Object.assign(new Event("storage"), {
      key: "indrax-analytics-consent",
      storageArea: {},
    })
  )
  expect(listener).not.toHaveBeenCalled()
  writeConsent("granted")
  expect(readConsent()).toBe("granted")
  clearConsent()
  expect(readConsent()).toBeNull()
  change("indrax-analytics-consent")
  change(null)
  expect(listener).toHaveBeenCalledTimes(4)
  unsubscribe()
  change(null)
  writeConsent("denied")
  expect(listener).toHaveBeenCalledTimes(4)
})

it("never preserves a stale grant after failed denial, clear, or grant", () => {
  writeConsent("granted")
  window.localStorage.setItem = blocked
  writeConsent("denied")
  expect(readConsent()).toBeNull()
  writeConsent("granted")
  expect(readConsent()).toBeNull()
  window.localStorage.removeItem = blocked
  clearConsent()
  expect(readConsent()).toBeNull()
})

it("validates consent and safely handles denied reads and the storage getter", () => {
  stored.set("indrax-analytics-consent", "yes")
  expect(readConsent()).toBeNull()
  window.localStorage.getItem = blocked
  expect(readConsent()).toBeNull()
  Object.defineProperty(window, "localStorage", { get: blocked })
  expect(readTheme()).toBe("light")
  expect(() => writeTheme("dark")).not.toThrow()
  expect(readTheme()).toBe("dark")
  expect(() => writeConsent("granted")).not.toThrow()
  expect(readConsent()).toBeNull()
})

it("retains failed display writes ahead of stale persistence until a relevant cross-tab change", () => {
  const preference = createDisplayPreference(
    "view",
    "view-change",
    "cards",
    (value): value is "cards" | "table" => value === "cards" || value === "table"
  )
  stored.set("view", "cards")
  window.localStorage.setItem = blocked
  const listener = vi.fn()
  const unsubscribe = preference.subscribe(listener)
  preference.write("table")
  expect(preference.read()).toBe("table")
  change("other")
  expect(preference.read()).toBe("table")
  expect(listener).toHaveBeenCalledTimes(1)
  change("view")
  expect(preference.read()).toBe("cards")
  stored.delete("view")
  change(null)
  expect(preference.read()).toBe("cards")
  unsubscribe()
  change(null)
  expect(listener).toHaveBeenCalledTimes(3)
})

it("returns defaults without a browser", () => {
  vi.stubGlobal("window", undefined)
  expect(readTheme()).toBe("light")
  expect(readConsent()).toBeNull()
  expect(() => writeTheme("dark")).not.toThrow()
  expect(() => clearConsent()).not.toThrow()
})

it("preserves raw theme values and rejects unknown stored preferences", () => {
  stored.set("indrax-theme", "sepia")
  expect(readTheme()).toBe("light")
  for (const value of ["dark", "system", "light"] as const) {
    writeTheme(value)
    expect(stored.get("indrax-theme")).toBe(value)
    expect(readTheme()).toBe(value)
  }
})
