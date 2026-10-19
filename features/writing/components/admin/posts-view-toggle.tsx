import { LayoutList, Table2 } from "lucide-react"
import { useSyncExternalStore } from "react"

import { ButtonGroup } from "@/components/ui/button-group"
import { controlClassNames } from "@/components/ui/variants"
import {
  DEFAULT_ADMIN_POSTS_VIEW,
  readAdminPostsView,
  subscribeToAdminPostsView,
  writeAdminPostsView,
  type AdminPostsView,
} from "@/features/writing/utils/admin-posts-view"
import { cn } from "@/lib/utils"

const VIEWS = [
  { value: "cards", label: "Cards", icon: LayoutList },
  { value: "table", label: "Table", icon: Table2 },
] as const satisfies readonly { value: AdminPostsView; label: string; icon: typeof Table2 }[]

/** The remembered layout, read during render so the first paint already uses it. */
export function useAdminPostsView(): AdminPostsView {
  return useSyncExternalStore(
    subscribeToAdminPostsView,
    readAdminPostsView,
    () => DEFAULT_ADMIN_POSTS_VIEW
  )
}

export function PostsViewToggle({ view }: { view: AdminPostsView }) {
  return (
    <ButtonGroup aria-label="Posts layout">
      {VIEWS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          data-slot="toggle"
          // Icon-only: the name comes from aria-label, and title shows it on hover.
          aria-label={label}
          title={label}
          aria-pressed={view === value}
          onClick={() => writeAdminPostsView(value)}
          // Styled from aria-pressed so the look always matches what is announced,
          // including while the pointer still rests on the button just chosen.
          className={cn(
            controlClassNames,
            "size-11 shrink-0 justify-center p-0 aria-pressed:bg-[var(--color-accent)] aria-pressed:text-[var(--color-accent-foreground)] aria-pressed:hover:bg-[var(--color-accent)]"
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      ))}
    </ButtonGroup>
  )
}
