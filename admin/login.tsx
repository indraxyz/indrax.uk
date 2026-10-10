import { House, ShieldAlert } from "lucide-react"
import { Navigate, useSearchParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { adminApi, adminKeys } from "@/features/writing/api/client"
import { AdminError, AdminLoading } from "./shared"

import { controlClassNames } from "@/components/ui/variants"
import { AdminShell } from "@/admin/components/admin-shell"
import { SignInButton } from "@/admin/components/sign-in-button"

export function Component() {
  const [searchParams] = useSearchParams()
  const session = useQuery({ queryKey: adminKeys.session, queryFn: adminApi.session, staleTime: 0 })
  if (session.isPending) return <AdminLoading />
  if (session.isError) return <AdminError retry={() => void session.refetch()} />
  if (session.data.author) return <Navigate to="/admin" replace />
  if (!session.data.authConfigured)
    return (
      <AdminShell title="Not found" signedIn={false}>
        <p>Author access is unavailable.</p>
      </AdminShell>
    )
  const error = searchParams.get("error")
  const denied = searchParams.get("denied")
  const failed = Boolean(error || denied)
  const accountDenied = error === "account_not_permitted" || (!error && denied === "1")
  const expired =
    error === "state_mismatch" ||
    error === "state_not_found" ||
    error === "please_restart_the_process"
  const message = accountDenied
    ? "This GitHub account does not have author access. Switch to the authorised account on GitHub, then try again."
    : expired
      ? "Your sign-in attempt expired or could not be verified. Start again from this page."
      : error === "access_denied"
        ? "GitHub sign-in was cancelled. You can try again when you are ready."
        : "We could not complete GitHub sign-in. Please try again."

  return (
    <AdminShell title="Sign in" signedIn={false}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 border-2 border-border bg-card px-6 py-16 text-center shadow-soft">
        {failed && <ShieldAlert className="h-10 w-10 text-foreground" aria-hidden />}
        <h2 className="text-2xl font-black uppercase tracking-tight">
          {failed
            ? accountDenied
              ? "Account not authorised"
              : "Sign-in unsuccessful"
            : "Author access"}
        </h2>

        <p className="text-sm font-semibold leading-relaxed text-muted-foreground">
          {failed ? message : "Sign in with the authorised GitHub account to manage your writing."}
        </p>

        <SignInButton retry={failed} />
        <a href="/" className={`${controlClassNames} px-5 py-3`}>
          <House className="h-4 w-4" aria-hidden />
          Back to site
        </a>
      </div>
    </AdminShell>
  )
}
