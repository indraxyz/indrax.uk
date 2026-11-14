import { Checkbox } from "@/components/ui/checkbox"
import { Archive, EyeOff, Send, X } from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"
import { useStore } from "zustand"
import { useQueryClient } from "@tanstack/react-query"
import { adminApi, adminKeys } from "../../api/client"
import { cachePostMutation, invalidatePostCollections } from "../../api/mutation-cache"
import { runBulkPostStatus } from "../../utils/bulk-post-status"
import type { AdminPostSummary, PostStatus } from "../../types"
import { usePostSelectionStore } from "./post-selection"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { LoadingIndicator } from "@/components/ui/loading-indicator"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const BULK_ACTIONS = [
  { status: "published", label: "Publish", icon: Send },
  { status: "draft", label: "Change to draft", icon: EyeOff },
  { status: "archived", label: "Archive", icon: Archive },
] as const satisfies readonly { status: PostStatus; label: string; icon: typeof Send }[]

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
  const [confirmation, setConfirmation] = useState<{
    status: PostStatus
    ids: string[]
  } | null>(null)
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
  const actionTrigger = useRef<HTMLButtonElement | null>(null)
  const ids = usable ? posts.map(({ id }) => id) : []
  const selectedPosts = usable ? posts.filter((post) => selectedIds.includes(post.id)) : []
  const selected = selectedPosts.map(({ id }) => id)
  const action = BULK_ACTIONS.find(({ status }) => status === confirmation?.status)
  // Revalidation can narrow the approved snapshot, but must never expand it.
  const confirmed = selectedPosts
    .filter((post) => confirmation?.ids.includes(post.id) && post.status !== confirmation.status)
    .map(({ id }) => id)
  const skipped = selectedPosts.filter((post) => post.status === action?.status).length
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

  const actionLabel = action?.label ?? "Archive"

  async function applyStatus() {
    if (!usable || !confirmation || !confirmed.length || !store.getState().begin()) return
    const snapshot = [...confirmed]
    const targetStatus = confirmation.status
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

  function focusPostCheckbox() {
    document.querySelector<HTMLInputElement>('input[type="checkbox"][data-post-selection]')?.focus()
  }

  return (
    <>
      {selectedIds.length > 0 && (
        <section
          aria-label="Post selection"
          className="flex flex-wrap items-center gap-2 border-2 border-border bg-card p-2"
        >
          <label
            className="inline-flex min-h-11 min-w-11 items-center justify-center"
            title="Select all posts on this page"
          >
            <Checkbox
              ref={selectAll}
              aria-label="Select all posts on this page"
              checked={ids.length > 0 && selected.length === ids.length}
              disabled={!usable || !ids.length || pending}
              onChange={() => {
                if (selected.length === ids.length) focusPostCheckbox()
                store.getState().select(selected.length === ids.length ? [] : ids)
              }}
            />
          </label>
          <span role="status" className="mr-auto text-sm">
            {selectedIds.length} selected
          </span>
          <ButtonGroup aria-label="Bulk post actions">
            {BULK_ACTIONS.map(({ status, label, icon: Icon }) => {
              const targets = selectedPosts
                .filter((post) => post.status !== status)
                .map(({ id }) => id)
              return (
                <Button
                  key={status}
                  type="button"
                  variant="secondary"
                  appearance="flat"
                  size="icon"
                  data-slot="button"
                  aria-label={`${label} selected`}
                  title={`${label} selected`}
                  disabled={!usable || pending || !targets.length}
                  onClick={(event) => {
                    actionTrigger.current = event.currentTarget
                    setConfirmation({ status, ids: targets })
                  }}
                >
                  <Icon aria-hidden />
                </Button>
              )
            })}
            <Button
              type="button"
              variant="secondary"
              appearance="flat"
              size="icon"
              data-slot="button"
              aria-label="Clear selection"
              title="Clear selection"
              disabled={pending}
              onClick={() => {
                focusPostCheckbox()
                store.getState().select([])
              }}
            >
              <X aria-hidden />
            </Button>
          </ButtonGroup>
        </section>
      )}
      <div role="status" aria-live="polite" className={pending || result ? "text-sm" : "sr-only"}>
        {pending
          ? "Updating selected posts. Keep this page open."
          : result
            ? `${result.succeeded.length} updated. ${result.failed.length} not confirmed. ${result.notAttempted.length} not attempted.${result.refreshFailed ? " Results could not be refreshed; refresh the list before selecting more posts." : ""}`
            : ""}
      </div>
      {!!result?.failed.length && (
        <ul className="text-sm text-destructive">
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
            if (actionTrigger.current?.isConnected) actionTrigger.current.focus()
            else focusPostCheckbox()
            return false
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{actionLabel} selected posts?</AlertDialogTitle>
            <AlertDialogDescription>
              {actionLabel} {confirmed.length} posts from this page?{" "}
              {skipped > 0 && (
                <>
                  {skipped} already {action?.status}; skipped.{" "}
                </>
              )}
              {action?.status === "published"
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
              {pending && <LoadingIndicator />}
              {pending ? "Updating…" : `${actionLabel} ${confirmed.length} posts`}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
