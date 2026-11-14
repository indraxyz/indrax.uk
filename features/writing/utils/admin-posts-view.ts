import { createDisplayPreference } from "@/lib/client-preference"

export const ADMIN_POSTS_VIEWS = ["cards", "table"] as const
export type AdminPostsView = (typeof ADMIN_POSTS_VIEWS)[number]

export const ADMIN_POSTS_VIEW_STORAGE_KEY = "indrax-admin-posts-view"
export const ADMIN_POSTS_VIEW_CHANGE_EVENT = "indrax-admin-posts-view-change"
export const DEFAULT_ADMIN_POSTS_VIEW: AdminPostsView = "cards"

const preference = createDisplayPreference(
  ADMIN_POSTS_VIEW_STORAGE_KEY,
  ADMIN_POSTS_VIEW_CHANGE_EVENT,
  DEFAULT_ADMIN_POSTS_VIEW,
  (value): value is AdminPostsView => value === "cards" || value === "table"
)
export const readAdminPostsView = preference.read
export const writeAdminPostsView = preference.write
export const subscribeToAdminPostsView = preference.subscribe
