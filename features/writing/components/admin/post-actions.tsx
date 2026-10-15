import { Menu } from "@base-ui/react/menu"
import { Archive, ExternalLink, Eye, EyeOff, Loader2, MoreHorizontal, Trash2 } from "lucide-react"
import { useNavigate } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import {
  cloneElement,
  isValidElement,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ButtonGroup } from "@/components/ui/button-group"
import { controlClassNames } from "@/components/ui/variants"
import { PostStatusDialog } from "./post-status-dialog"
import { adminApi, adminKeys, writingKeys } from "@/features/writing/api/client"
import { apiErrorMessage } from "@/lib/api-client"
import type { AdminPost, PostStatus } from "@/features/writing/types"
import { cn } from "@/lib/utils"

type Action = "view" | "status" | "delete"
const menuItemClass =
  "flex min-h-11 items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] outline-none data-highlighted:bg-muted data-disabled:opacity-50"

/** Shared editor/list actions, ordered from viewing to status changes to deletion. */
export function PostActions({
  post: savedPost,
  children,
  onDeleted,
  hasUnsavedChanges = false,
  saving = false,
  context = "editor",
}: {
  post: Pick<AdminPost, "id" | "slug" | "title" | "status"> | null
  children?: ReactNode
  onDeleted?: () => void
  hasUnsavedChanges?: boolean
  saving?: boolean
  context?: "editor" | "list"
}) {
  const post = savedPost ?? { id: "", slug: "", title: "Untitled post", status: "draft" as const }
  const savedHint = !savedPost
    ? "Save the post first"
    : hasUnsavedChanges
      ? "Save changes first"
      : undefined
  const actionLabel = context === "list" ? `Actions for ${post.title}` : "More post actions"
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()
  const [activeAction, setActiveAction] = useState<Action | null>(null)
  const running = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [targetStatus, setTargetStatus] = useState<PostStatus>(
    post.status === "published" ? "draft" : "published"
  )
  const [statusOpen, setStatusOpen] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const published = post.status === "published"
  const busy = pending || saving
  const requiresSaved = !savedPost || busy || hasUnsavedChanges

  const run = (
    kind: Action,
    action: () => Promise<{ ok: boolean; message?: string }>,
    then?: () => void,
    reportError = setError
  ) => {
    if (!savedPost || running.current || saving) return
    running.current = true
    setActiveAction(kind)
    reportError(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) {
          reportError(result.message ?? "That did not work.")
          return
        }
        if (kind !== "view")
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: adminKeys.posts }),
            queryClient.invalidateQueries({ queryKey: adminKeys.tags() }),
            queryClient.invalidateQueries({ queryKey: adminKeys.post(post.id) }),
            queryClient.invalidateQueries({ queryKey: adminKeys.overview }),
            queryClient.invalidateQueries({ queryKey: writingKeys.all }),
          ])
        then?.()
      } catch (error) {
        reportError(apiErrorMessage(error))
      } finally {
        running.current = false
        setActiveAction(null)
      }
    })
  }

  const openPost = () => {
    if (running.current || requiresSaved) return
    // Open during the click so async preview signing does not trigger popup blockers.
    const tab = window.open("about:blank", "_blank")
    if (!tab) {
      setError("Could not open the post. Allow pop-ups for this site and try again.")
      return
    }
    tab.opener = null
    run("view", async () => {
      let opened = false
      try {
        let url = `/writing/${post.slug}`
        if (!published) {
          const result = await adminApi.createPreviewLink(post.id)
          if (!result.ok || !result.url)
            return { ok: false, message: result.message ?? "That preview could not be opened." }
          url = result.url
        }
        if (!tab.closed) tab.location.replace(new URL(url, location.origin).toString())
        opened = true
        setMenuOpen(false)
        return { ok: true }
      } finally {
        if (!opened) tab.close()
      }
    })
  }
  const saveControl = isValidElement<{ disabled?: boolean }>(children)
    ? cloneElement(children, { disabled: busy || children.props.disabled })
    : children

  return (
    <div className="flex flex-col items-end gap-2">
      <ButtonGroup aria-label="Post actions">
        {saveControl}
        <Menu.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Menu.Trigger
            ref={trigger}
            data-slot="button"
            disabled={busy}
            aria-label={actionLabel}
            title={actionLabel}
            className={cn(
              controlClassNames,
              "h-11 w-11 shrink-0 justify-center bg-card p-0 disabled:opacity-60"
            )}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner align="end" sideOffset={8} className="z-[60]">
              <Menu.Popup className="min-w-48 max-w-[calc(100vw-2rem)] border-2 border-border bg-card p-1 text-card-foreground shadow-soft-lg outline-none">
                {!savedPost && (
                  <p className="max-w-64 px-3 py-2 text-xs text-muted-foreground">
                    Save the post to enable these actions.
                  </p>
                )}
                <Menu.Item
                  disabled={requiresSaved}
                  closeOnClick={false}
                  onClick={openPost}
                  className={menuItemClass}
                  title={savedHint ?? "Opens in a new tab"}
                >
                  {activeAction === "view" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : published ? (
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                  {activeAction === "view" ? "Opening…" : published ? "Visit" : "Preview"}
                </Menu.Item>
                <Menu.Item
                  disabled={requiresSaved}
                  onClick={() => {
                    setTargetStatus(published ? "draft" : "published")
                    setStatusError(null)
                    setStatusOpen(true)
                  }}
                  className={menuItemClass}
                  title={savedHint}
                >
                  {published ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                  {published ? "Unpublish" : "Publish"}
                </Menu.Item>
                {post.status !== "archived" && (
                  <Menu.Item
                    disabled={requiresSaved}
                    onClick={() => {
                      setTargetStatus("archived")
                      setStatusError(null)
                      setStatusOpen(true)
                    }}
                    className={menuItemClass}
                    title={savedHint}
                  >
                    <Archive className="h-4 w-4" aria-hidden />
                    Archive
                  </Menu.Item>
                )}
                {error && (
                  <p
                    role="alert"
                    className="max-w-64 px-3 py-2 text-xs font-semibold text-destructive"
                  >
                    {error}
                  </p>
                )}
                <Menu.Separator className="my-1 h-0.5 bg-border" />
                <Menu.Item
                  disabled={busy || !savedPost}
                  title={savedPost ? undefined : savedHint}
                  onClick={() => {
                    setDeleteError(null)
                    setDeleteOpen(true)
                  }}
                  className={cn(menuItemClass, "text-destructive")}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Delete
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </ButtonGroup>
      {error && !menuOpen && (
        <p role="alert" className="max-w-sm text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
      <PostStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        targetStatus={targetStatus}
        title={post.title}
        pending={activeAction === "status"}
        error={statusError}
        returnFocus={trigger}
        onConfirm={() =>
          run(
            "status",
            () => adminApi.setPostStatus(post.id, targetStatus),
            () => setStatusOpen(false),
            setStatusError
          )
        }
      />
      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!pending) setDeleteOpen(open)
        }}
      >
        <AlertDialogContent finalFocus={trigger}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete post?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete “{post.title}”? This removes the post and its tag links. It cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p role="alert" className="mt-4 text-sm font-semibold text-destructive">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() =>
                run(
                  "delete",
                  () => adminApi.deletePost(post.id),
                  () => {
                    setDeleteOpen(false)
                    onDeleted?.()
                    if (context === "editor") navigate("/admin/posts", { replace: true })
                  },
                  setDeleteError
                )
              }
            >
              {activeAction === "delete" && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              )}
              {activeAction === "delete" ? "Deleting…" : "Delete post"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
