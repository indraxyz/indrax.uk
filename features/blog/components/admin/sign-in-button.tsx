"use client"

import { useState, useTransition } from "react"

import { GithubIcon } from "@/components/ui/github-icon"
import { controlClassNames } from "@/components/ui/variants"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

export function SignInButton() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className={cn(controlClassNames, "px-5 py-3 disabled:opacity-60")}
        onClick={() => {
          setError(null)
          startTransition(async () => {
            const result = await authClient.signIn.social({
              provider: "github",
              callbackURL: "/admin",
              // Where GitHub sends someone the allow-list refuses. Back to the
              // login page rather than to a stack trace.
              errorCallbackURL: "/admin/login?denied=1",
            })

            if (result?.error) setError("That account cannot sign in here.")
          })
        }}
      >
        <GithubIcon className="h-4 w-4" />
        {pending ? "Redirecting..." : "Continue with GitHub"}
      </button>

      {error && (
        <p role="alert" className="text-xs font-black uppercase tracking-[0.14em] text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
