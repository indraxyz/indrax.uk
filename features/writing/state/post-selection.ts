import { createStore } from "zustand/vanilla"

export interface BulkResult {
  succeeded: string[]
  failed: { id: string; message: string }[]
  stopped: boolean
  notAttempted: string[]
  refreshFailed?: boolean
  unauthorized?: boolean
}

/** Transient state for one mounted archive/URL. Never persisted or shared across sessions. */
export function createPostSelectionStore() {
  return createStore<{
    selectedIds: string[]
    pending: boolean
    result: BulkResult | null
    toggle: (id: string) => void
    select: (ids: string[]) => void
    prune: (ids: string[]) => void
    begin: () => boolean
    finish: (result: BulkResult) => void
  }>((set, get) => ({
    selectedIds: [],
    pending: false,
    result: null,
    toggle: (id) => {
      if (get().pending) return
      set(({ selectedIds }) => ({
        selectedIds: selectedIds.includes(id)
          ? selectedIds.filter((selected) => selected !== id)
          : [...selectedIds, id],
        result: null,
      }))
    },
    select: (ids) => {
      if (!get().pending) set({ selectedIds: [...new Set(ids)], result: null })
    },
    prune: (ids) => {
      const selectedIds = get().selectedIds.filter((id) => ids.includes(id))
      if (selectedIds.length !== get().selectedIds.length) set({ selectedIds })
    },
    begin: () => {
      if (get().pending) return false
      set({ pending: true, result: null })
      return true
    },
    finish: (result) =>
      set({ pending: false, selectedIds: result.failed.map(({ id }) => id), result }),
  }))
}
