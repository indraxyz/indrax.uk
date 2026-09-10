"use client"

import { useRouter } from "next/navigation"
import { useTransition, type ReactNode } from "react"

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

  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() => {
        startTransition(async () => {
          await authClient.signOut()
          router.replace("/admin/login")
          router.refresh()
        })
      }}
    >
      {children}
    </button>
  )
}
