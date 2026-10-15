import type { RefObject } from "react"
import { Loader2 } from "lucide-react"
import type { PostStatus } from "@/features/writing/types"
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

/** Shared confirmation for saved-post actions and publication changes during Save. */
export function PostStatusDialog({
  open,
  onOpenChange,
  targetStatus,
  title,
  pending,
  error,
  onConfirm,
  returnFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetStatus: PostStatus
  title: string
  pending: boolean
  error?: string | null
  onConfirm: () => void
  returnFocus?: RefObject<HTMLElement | null>
}) {
  const copy = {
    published: {
      heading: "Publish post?",
      description: `Publish “${title}”? It will be visible to everyone.`,
      action: "Publish post",
      pending: "Publishing…",
    },
    draft: {
      heading: "Unpublish post?",
      description: `Unpublish “${title}”? It will no longer be visible on the public site.`,
      action: "Unpublish post",
      pending: "Unpublishing…",
    },
    archived: {
      heading: "Archive post?",
      description: `Archive “${title}”? It will be hidden from the public site. You can publish it again later.`,
      action: "Archive post",
      pending: "Archiving…",
    },
  }[targetStatus]
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next)
      }}
    >
      <AlertDialogContent finalFocus={returnFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.heading}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="mt-4 text-sm font-semibold text-destructive">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button type="button" size="sm" disabled={pending} onClick={onConfirm}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? copy.pending : copy.action}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
