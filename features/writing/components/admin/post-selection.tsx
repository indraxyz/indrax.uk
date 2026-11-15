import { Checkbox } from "@/components/ui/checkbox"
import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useStore } from "zustand"
import { PostActions } from "./post-actions"
import type { AdminPostSummary } from "../../types"
import { createPostSelectionStore } from "../../state/post-selection"

const SelectionContext = createContext<ReturnType<typeof createPostSelectionStore> | null>(null)
export function PostSelectionProvider({ children, scope }: { children: ReactNode; scope: string }) {
  const store = useMemo(createPostSelectionStore, [scope])
  return <SelectionContext value={store}>{children}</SelectionContext>
}
export function usePostSelectionStore() {
  const store = useContext(SelectionContext)
  if (!store) throw new Error("Post selection requires its archive provider")
  return store
}
export function PostSelectionCheckbox({
  id,
  title,
  disabled = false,
}: {
  id: string
  title: string
  disabled?: boolean
}) {
  const store = usePostSelectionStore()
  const selected = useStore(store, (state) => state.selectedIds.includes(id))
  const pending = useStore(store, (state) => state.pending)
  return (
    <label className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center">
      <Checkbox
        data-post-selection
        aria-label={`Select ${title}`}
        checked={selected}
        disabled={disabled || pending}
        onChange={() => store.getState().toggle(id)}
      />
    </label>
  )
}

function ManagedPostActions({ post }: { post: AdminPostSummary }) {
  const store = usePostSelectionStore()
  const pending = useStore(store, (state) => state.pending)
  return <PostActions post={post} context="list" saving={pending} />
}
export function ListPostActions({ post }: { post: AdminPostSummary }) {
  const store = useContext(SelectionContext)
  return store ? <ManagedPostActions post={post} /> : <PostActions post={post} context="list" />
}
