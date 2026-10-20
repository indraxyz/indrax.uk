export const ADMIN_POSTS_VIEWS = ["cards", "table"] as const
export type AdminPostsView = (typeof ADMIN_POSTS_VIEWS)[number]

export const ADMIN_POSTS_VIEW_STORAGE_KEY = "indrax-admin-posts-view"
export const ADMIN_POSTS_VIEW_CHANGE_EVENT = "indrax-admin-posts-view-change"
export const DEFAULT_ADMIN_POSTS_VIEW: AdminPostsView = "cards"

/**
 * The remembered layout for this browser.
 *
 * A display preference rather than an archive criterion, so it stays out of the
 * URL: search, filters and pagination rebuild the query from archive options
 * alone. Storage can throw in some privacy modes; the default is always usable.
 */
export function readAdminPostsView(): AdminPostsView {
  try {
    const value = window.localStorage.getItem(ADMIN_POSTS_VIEW_STORAGE_KEY)
    return ADMIN_POSTS_VIEWS.includes(value as AdminPostsView)
      ? (value as AdminPostsView)
      : DEFAULT_ADMIN_POSTS_VIEW
  } catch {
    return DEFAULT_ADMIN_POSTS_VIEW
  }
}

export function writeAdminPostsView(view: AdminPostsView): void {
  try {
    window.localStorage.setItem(ADMIN_POSTS_VIEW_STORAGE_KEY, view)
  } catch {
    // The choice still applies until reload; it just is not remembered.
  }
  // Storage events only reach other tabs; this tells subscribers in this one.
  window.dispatchEvent(new CustomEvent(ADMIN_POSTS_VIEW_CHANGE_EVENT, { detail: view }))
}

export function subscribeToAdminPostsView(callback: () => void): () => void {
  window.addEventListener("storage", callback)
  window.addEventListener(ADMIN_POSTS_VIEW_CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(ADMIN_POSTS_VIEW_CHANGE_EVENT, callback)
  }
}
