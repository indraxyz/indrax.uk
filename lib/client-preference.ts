/** Subscribe only to changes affecting one local preference. */
export function subscribeToPreference(
  key: string,
  event: string,
  callback: () => void,
  onStorage?: () => void
) {
  if (typeof window === "undefined") return () => {}
  const storage = (change: StorageEvent) => {
    if (change.key !== null && change.key !== key) return
    try {
      if (change.storageArea && change.storageArea !== window.localStorage) return
    } catch {
      // A denied storage getter still requires consumers to reread safely.
    }
    onStorage?.()
    callback()
  }
  window.addEventListener("storage", storage)
  window.addEventListener(event, callback)
  return () => {
    window.removeEventListener("storage", storage)
    window.removeEventListener(event, callback)
  }
}

/** Display-only preference: a failed write still applies in this document. */
export function createDisplayPreference<T extends string>(
  key: string,
  event: string,
  fallback: T,
  valid: (value: string | null) => value is T
) {
  const overrides = new WeakMap<Window, T>()
  const read = (): T => {
    if (typeof window === "undefined") return fallback
    const override = overrides.get(window)
    if (override !== undefined) return override
    try {
      const value = window.localStorage.getItem(key)
      return valid(value) ? value : fallback
    } catch {
      return fallback
    }
  }
  return {
    read,
    write(value: T) {
      if (typeof window === "undefined") return
      try {
        window.localStorage.setItem(key, value)
        overrides.delete(window)
      } catch {
        overrides.set(window, value)
      }
      window.dispatchEvent(new Event(event))
    },
    subscribe(callback: () => void) {
      return subscribeToPreference(key, event, callback, () => overrides.delete(window))
    },
  }
}
