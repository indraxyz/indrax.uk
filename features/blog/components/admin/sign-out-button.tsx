"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition, type ReactNode } from "react"

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
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [failed, setFailed] = useState(false)

  return (
    <>
      <button
        type="button"
        disabled={pending}
        className={className}
        onClick={() => {
          setFailed(false)
          startTransition(async () => {
            const result = await authClient.signOut()

            // The client returns `{ error }` rather than throwing, so this used to
            // redirect to the login page whatever happened - showing someone they
            // were signed out while their session was still live on the server.
            // Being told it did not work is the only honest option.
            if (result?.error) {
              setFailed(true)
              return
            }

            router.replace("/admin/login")
            router.refresh()
          })
        }}
      >
        {children}
      </button>

      {failed && (
        <p role="alert" className="text-xs font-black uppercase tracking-[0.14em] text-destructive">
          Sign-out failed. Your session is still active.
        </p>
      )}
    </>
  )
}
