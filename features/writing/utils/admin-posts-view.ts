import { getAdminPreferences } from "@/admin/state/admin-preferences"

export {
  ADMIN_POSTS_VIEWS,
  ADMIN_POSTS_VIEW_STORAGE_KEY,
  ADMIN_POSTS_VIEW_CHANGE_EVENT,
  DEFAULT_ADMIN_POSTS_VIEW,
  type AdminPostsView,
} from "@/admin/state/admin-preferences"
import type { AdminPostsView } from "@/admin/state/admin-preferences"

export const readAdminPostsView = () => getAdminPreferences().read()
export const writeAdminPostsView = (view: AdminPostsView) => getAdminPreferences().write(view)
export const subscribeToAdminPostsView = (callback: () => void) =>
  getAdminPreferences().subscribe(callback)
