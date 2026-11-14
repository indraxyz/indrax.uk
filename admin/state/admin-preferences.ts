import { createStore } from "zustand/vanilla"
import { createDisplayPreference } from "@/lib/client-preference"

export const ADMIN_POSTS_VIEWS = ["cards", "table"] as const
export type AdminPostsView = (typeof ADMIN_POSTS_VIEWS)[number]
export const ADMIN_POSTS_VIEW_STORAGE_KEY = "indrax-admin-posts-view"
export const ADMIN_POSTS_VIEW_CHANGE_EVENT = "indrax-admin-posts-view-change"
export const DEFAULT_ADMIN_POSTS_VIEW: AdminPostsView = "cards"

/** Storage keeps its original raw format; Zustand owns subscribed display state. */
export function createAdminPreferences() {
  const preference = createDisplayPreference(
    ADMIN_POSTS_VIEW_STORAGE_KEY,
    ADMIN_POSTS_VIEW_CHANGE_EVENT,
    DEFAULT_ADMIN_POSTS_VIEW,
    (value): value is AdminPostsView => value === "cards" || value === "table"
  )
  const store = createStore(() => ({ postsView: preference.read() }))
  const sync = () => store.setState({ postsView: preference.read() })
  return {
    store,
    read: preference.read,
    write(view: AdminPostsView) {
      preference.write(view)
      sync()
    },
    subscribe(callback: () => void) {
      sync()
      return preference.subscribe(() => {
        sync()
        callback()
      })
    },
  }
}

const browsers = new WeakMap<Window, ReturnType<typeof createAdminPreferences>>()
export function getAdminPreferences() {
  // Admin is CSR; avoiding a server singleton also keeps isolated tests independent.
  if (typeof window === "undefined") return createAdminPreferences()
  let preferences = browsers.get(window)
  if (!preferences) {
    preferences = createAdminPreferences()
    browsers.set(window, preferences)
  }
  return preferences
}
