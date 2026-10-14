import { Menu } from "@base-ui/react/menu"
import { Check, Eye, EyeOff, Link2, Loader2, MoreHorizontal, Trash2 } from "lucide-react"
import { useNavigate } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import {
  cloneElement,
  isValidElement,
  useEffect,
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
import type { AdminPost } from "@/features/writing/types"
import { cn } from "@/lib/utils"

type Action = "copy" | "status" | "delete"
const menuItemClass =
  "flex min-h-11 items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] outline-none data-highlighted:bg-muted data-disabled:opacity-50"

/** Save stays primary; secondary actions share one accessible overflow menu. */
export function PostActions({
  post,
  children,
  onDeleted,
  hasUnsavedChanges = false,
  saving = false,
}: {
  post: AdminPost
  children?: ReactNode
  onDeleted?: () => void
  hasUnsavedChanges?: boolean
  saving?: boolean
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()
  const [activeAction, setActiveAction] = useState<Action | null>(null)
  const running = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [statusPublishing, setStatusPublishing] = useState(post.status !== "published")
  const [statusOpen, setStatusOpen] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => () => clearTimeout(copyTimer.current), [])
  const published = post.status === "published"
  const busy = pending || saving
  const requiresSaved = busy || hasUnsavedChanges

  const run = (
    kind: Action,
    action: () => Promise<{ ok: boolean; message?: string }>,
    then?: () => void,
    reportError = setError
  ) => {
    if (running.current || saving) return
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
        if (kind !== "copy")
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

  const copyLink = () =>
    run("copy", async () => {
      let url = new URL(`/writing/${post.slug}`, location.origin).toString()
      if (!published) {
        const result = await adminApi.createPreviewLink(post.id)
        if (!result.ok || !result.url)
          return { ok: false, message: result.message ?? "That link could not be created." }
        url = new URL(result.url, location.origin).toString()
      }
      try {
        await navigator.clipboard.writeText(url)
      } catch {
        return {
          ok: false,
          message: "Could not copy the link. Allow clipboard access and try again.",
        }
      }
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 3000)
      return { ok: true }
    })
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
            aria-label="More post actions"
            title="More post actions"
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
                <Menu.Item
                  disabled={requiresSaved}
                  closeOnClick={false}
                  onClick={copyLink}
                  className={menuItemClass}
                  title={hasUnsavedChanges ? "Save changes first" : undefined}
                >
                  {activeAction === "copy" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : copied ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : (
                    <Link2 className="h-4 w-4" aria-hidden />
                  )}
                  {activeAction === "copy" ? "Copying…" : copied ? "Copied" : "Copy link"}
                </Menu.Item>
                <Menu.Item
                  disabled={requiresSaved}
                  onClick={() => {
                    setStatusPublishing(!published)
                    setStatusError(null)
                    setStatusOpen(true)
                  }}
                  className={menuItemClass}
                  title={hasUnsavedChanges ? "Save changes first" : undefined}
                >
                  {published ? (
                    <EyeOff className="h-4 w-4" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )}
                  {published ? "Unpublish" : "Publish"}
                </Menu.Item>
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
                  disabled={busy}
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
      <span role="status" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
      <PostStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        publishing={statusPublishing}
        title={post.title}
        pending={activeAction === "status"}
        error={statusError}
        returnFocus={trigger}
        onConfirm={() =>
          run(
            "status",
            () => adminApi.setPostStatus(post.id, statusPublishing ? "published" : "draft"),
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
                    navigate("/admin/posts", { replace: true })
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
