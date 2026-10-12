import type { RefObject } from "react"
import { Loader2 } from "lucide-react"
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
  publishing,
  title,
  pending,
  error,
  onConfirm,
  returnFocus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  publishing: boolean
  title: string
  pending: boolean
  error?: string | null
  onConfirm: () => void
  returnFocus?: RefObject<HTMLElement | null>
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next)
      }}
    >
      <AlertDialogContent finalFocus={returnFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{publishing ? "Publish post?" : "Unpublish post?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {publishing
              ? `Publish “${title}”? It will be visible to everyone.`
              : `Unpublish “${title}”? It will no longer be visible on the public site.`}
          </AlertDialogDescription>
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
            {pending
              ? publishing
                ? "Publishing…"
                : "Unpublishing…"
              : publishing
                ? "Publish post"
                : "Unpublish post"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
