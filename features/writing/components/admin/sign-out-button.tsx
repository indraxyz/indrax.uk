import { useNavigate } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { adminKeys } from "@/features/writing/api/client"
import { useState, useTransition, type ReactNode } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { authClient } from "@/lib/auth-client"

interface SignOutButtonProps {
  children: ReactNode
  className?: string
}

/**
 * Ends the session at the server, not just in the browser.
 *
 * Better Auth deletes the session row, so the cookie that was just cleared would
 * be useless even if it were replayed - which is what makes signing out mean
 * something rather than merely looking like it (PRD US-4.2).
 */
export function SignOutButton({ children, className }: SignOutButtonProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pending, startTransition] = useTransition()
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  function signOut() {
    setFailed(false)
    startTransition(async () => {
      try {
        const result = await authClient.signOut()
        if (result?.error) {
          setFailed(true)
          return
        }

        setOpen(false)
        queryClient.removeQueries({ queryKey: adminKeys.all })
        queryClient.getMutationCache().clear()
        navigate("/admin/login", { replace: true })
      } catch {
        setFailed(true)
      }
    })
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) setFailed(false)
      }}
    >
      <AlertDialogTrigger className={className}>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to end your admin session?
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failed && (
          <p role="alert" className="mt-4 text-sm font-semibold text-destructive">
            Sign-out failed. Your session is still active.
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={signOut}>
            {pending ? "Signing out…" : "Sign out"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
