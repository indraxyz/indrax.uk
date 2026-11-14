import { useLayoutEffect, useRef, useState } from "react"
import { useStore } from "zustand"
import { useQueryClient } from "@tanstack/react-query"
import { adminApi, adminKeys } from "../../api/client"
import { cachePostMutation, invalidatePostCollections } from "../../api/mutation-cache"
import { runBulkPostStatus } from "../../utils/bulk-post-status"
import type { AdminPostSummary, PostStatus } from "../../types"
import { usePostSelectionStore } from "./post-selection"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/** Only authoritative rows from the currently loaded page may become action targets. */
export function BulkPostActions({
  posts,
  ready,
  refreshVersion,
}: {
  posts: AdminPostSummary[]
  ready: boolean
  refreshVersion: number
}) {
  const store = usePostSelectionStore()
  const selectedIds = useStore(store, (state) => state.selectedIds)
  const pending = useStore(store, (state) => state.pending)
  const result = useStore(store, (state) => state.result)
  const client = useQueryClient()
  const [targetStatus, setTargetStatus] = useState<PostStatus>("archived")
  const [confirmation, setConfirmation] = useState<string[] | null>(null)
  const failedRefreshVersion = useRef<number | null>(null)
  const usable =
    ready &&
    (failedRefreshVersion.current === null || refreshVersion > failedRefreshVersion.current)
  const alive = useRef(true)
  const currentStore = useRef(store)
  useLayoutEffect(() => {
    currentStore.current = store
    setConfirmation(null)
  }, [store])
  const selectAll = useRef<HTMLInputElement>(null)
  const actionSelect = useRef<HTMLSelectElement>(null)
  const ids = usable ? posts.map(({ id }) => id) : []
  const selected = selectedIds.filter((id) => ids.includes(id))
  const targets = selected.filter(
    (id) => posts.find((post) => post.id === id)?.status !== targetStatus
  )
  const confirmed = confirmation?.filter((id) => targets.includes(id)) ?? []
  useLayoutEffect(() => {
    if (ready) store.getState().prune(posts.map(({ id }) => id))
  }, [posts, ready, store])
  useLayoutEffect(() => {
    if (selectAll.current)
      selectAll.current.indeterminate = selected.length > 0 && selected.length < ids.length
  }, [selected.length, ids.length])
  useLayoutEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const actionLabel = { published: "Publish", draft: "Change to draft", archived: "Archive" }[
    targetStatus
  ]

  async function applyStatus() {
    if (!usable || !confirmed.length || !store.getState().begin()) return
    const snapshot = [...confirmed]
    try {
      const outcome = await runBulkPostStatus({
        ids: snapshot,
        status: targetStatus,
        change: adminApi.setPostStatus,
        acknowledge: (result) => {
          cachePostMutation(client, result)
          if (!result.post && !result.postState && result.postId)
            void client.invalidateQueries({
              queryKey: adminKeys.post(result.postId),
              refetchType: "none",
            })
        },
        isActive: () => alive.current && currentStore.current === store,
      })
      if (outcome.unauthorized && alive.current && currentStore.current === store) {
        window.dispatchEvent(new Event("admin-session-expired"))
      }
      if (!outcome.unauthorized) {
        try {
          await invalidatePostCollections(client)
        } catch {
          outcome.refreshFailed = true
          failedRefreshVersion.current = refreshVersion
        }
      }
      if (alive.current && currentStore.current === store) {
        store.getState().finish(outcome)
        setConfirmation(null)
      }
    } catch {
      if (alive.current && currentStore.current === store) {
        store.getState().finish({
          succeeded: [],
          failed: snapshot.map((id) => ({
            id,
            message: "The results could not be refreshed. Refresh the list before retrying.",
          })),
          stopped: false,
          notAttempted: [],
        })
        setConfirmation(null)
      }
    }
  }

  return (
    <section
      aria-label="Post selection"
      className="flex flex-wrap items-center gap-2 border-2 border-border bg-card p-3"
    >
      <label className="inline-flex min-h-11 items-center gap-2 px-2 focus-within:ring-2 focus-within:ring-ring">
        <input
          ref={selectAll}
          type="checkbox"
          aria-label="Select all posts on this page"
          checked={ids.length > 0 && selected.length === ids.length}
          disabled={!usable || !ids.length || pending}
          onChange={() => store.getState().select(selected.length === ids.length ? [] : ids)}
          className="size-4 accent-primary"
        />
        Select this page
      </label>
      <span>{selected.length} selected</span>
      <Button
        type="button"
        variant="ghost"
        disabled={!selected.length || pending}
        onClick={() => store.getState().select([])}
      >
        Clear selection
      </Button>
      <label className="inline-flex min-h-11 items-center gap-2">
        Action
        <select
          ref={actionSelect}
          aria-label="Bulk post action"
          className="min-h-11 border-2 border-border bg-background px-2"
          value={targetStatus}
          disabled={pending}
          onChange={(event) => {
            setTargetStatus(event.target.value as PostStatus)
            store.getState().select(selected)
          }}
        >
          <option value="archived">Archive</option>
          <option value="draft">Change to draft</option>
          <option value="published">Publish</option>
        </select>
      </label>
      <Button
        type="button"
        disabled={!usable || !targets.length || pending}
        onClick={() => setConfirmation([...targets])}
      >
        {pending ? "Updating…" : `${actionLabel} selected`}
      </Button>
      {selected.length > targets.length && (
        <p className="basis-full text-sm">
          {selected.length - targets.length} already {targetStatus}; excluded from this action.
        </p>
      )}
      <p role="status" aria-live="polite" className="basis-full text-sm">
        {pending
          ? "Updating selected posts. Keep this page open."
          : result
            ? `${result.succeeded.length} updated. ${result.failed.length} not confirmed. ${result.notAttempted.length} not attempted.${result.refreshFailed ? " Results could not be refreshed; refresh the list before selecting more posts." : ""}`
            : `${selected.length} posts selected on this page.`}
      </p>
      {!!result?.failed.length && (
        <ul className="basis-full text-sm text-destructive">
          {result.failed.map(({ id, message }) => (
            <li key={id}>
              {posts.find((post) => post.id === id)?.title ?? id}: {message}
            </li>
          ))}
        </ul>
      )}
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!pending && !open) setConfirmation(null)
        }}
      >
        <AlertDialogContent
          finalFocus={() => {
            actionSelect.current?.focus()
            return false
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{actionLabel} selected posts?</AlertDialogTitle>
            <AlertDialogDescription>
              {actionLabel} {confirmed.length} posts from this page?{" "}
              {targetStatus === "published"
                ? "They will be visible to everyone. Posts without publishable content or cover alt text may be refused."
                : "They will be hidden from the public site."}{" "}
              Each post is updated separately; some updates may not be confirmed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={pending || !usable || !confirmed.length}
              onClick={() => void applyStatus()}
            >
              {pending ? "Updating…" : `${actionLabel} ${confirmed.length} posts`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
