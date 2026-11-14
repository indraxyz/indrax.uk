import { Checkbox } from "@/components/ui/checkbox"
import { Menu } from "@base-ui/react/menu"
import { Archive, EyeOff, MoreHorizontal, Send, X } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useStore } from "zustand"
import { useQueryClient } from "@tanstack/react-query"
import { adminApi, adminKeys } from "../../api/client"
import { cachePostMutation, invalidatePostCollections } from "../../api/mutation-cache"
import { runBulkPostStatus } from "../../utils/bulk-post-status"
import type { AdminPostSummary, PostStatus } from "../../types"
import { usePostSelectionStore } from "./post-selection"
import { Button, buttonVariants } from "@/components/ui/button"
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
  const hasSelection = selectedIds.length > 0
  const bar = useRef<HTMLElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
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
    setMenuOpen(false)
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

  useEffect(() => {
    if (!hasSelection) return
    // A fixed bar must not leave keyboard focus hidden behind it. CSS reserves
    // bottom scroll space; this also handles controls already inside the viewport.
    const revealFocus = (event: FocusEvent) => {
      const target = event.target
      const floating = bar.current
      if (!(target instanceof HTMLElement) || !floating || floating.contains(target)) return
      if (target.closest('[role="menu"], [role="dialog"], [role="alertdialog"]')) return
      const bounds = target.getBoundingClientRect()
      const overlay = floating.getBoundingClientRect()
      if (
        bounds.bottom > overlay.top - 8 &&
        bounds.top < overlay.bottom &&
        bounds.right > overlay.left &&
        bounds.left < overlay.right
      )
        target.scrollIntoView({ block: "center", inline: "nearest" })
    }
    document.addEventListener("focusin", revealFocus)
    return () => document.removeEventListener("focusin", revealFocus)
  }, [hasSelection])

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
      {hasSelection && (
        <section
          ref={bar}
          data-slot="post-selection-bar"
          aria-label="Post selection"
          className="m-0! fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex w-max max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 border-2 border-border bg-background p-2 shadow-soft-lg"
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
          <span role="status" className="whitespace-nowrap text-sm">
            {selectedIds.length} selected
          </span>
          <ButtonGroup aria-label="Bulk post actions">
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
            <Menu.Root open={menuOpen} onOpenChange={setMenuOpen}>
              <Menu.Trigger
                ref={actionTrigger}
                data-slot="button"
                aria-label="Bulk post actions"
                title="Bulk post actions"
                disabled={!usable || pending}
                className={buttonVariants({
                  variant: "secondary",
                  appearance: "flat",
                  size: "icon",
                  className: "data-popup-open:bg-accent data-popup-open:text-accent-foreground",
                })}
              >
                <MoreHorizontal aria-hidden />
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner side="top" align="end" sideOffset={16} className="z-[60]">
                  <Menu.Popup className="min-w-48 max-w-[calc(100vw-2rem)] border-2 border-border bg-background p-1 text-foreground shadow-soft-lg outline-none">
                    {BULK_ACTIONS.map(({ status, label, icon: Icon }) => {
                      const targets = selectedPosts
                        .filter((post) => post.status !== status)
                        .map(({ id }) => id)
                      return (
                        <Menu.Item
                          key={status}
                          disabled={!usable || pending || !targets.length}
                          aria-description={
                            usable && !targets.length
                              ? `Selected posts are already ${status}.`
                              : undefined
                          }
                          className="flex min-h-11 items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] outline-none data-highlighted:bg-primary data-highlighted:text-primary-foreground data-disabled:opacity-50"
                          onClick={() => {
                            setMenuOpen(false)
                            setConfirmation({ status, ids: targets })
                          }}
                        >
                          <Icon className="size-4" aria-hidden />
                          {label}
                        </Menu.Item>
                      )
                    })}
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
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
