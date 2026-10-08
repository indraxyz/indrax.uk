import { House, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { controlClassNames } from "@/components/ui/variants"
import { AdminShell } from "@/features/writing/components/admin/admin-shell"
import { SignInButton } from "@/features/writing/components/admin/sign-in-button"
import { getAuthor } from "@/lib/auth-guard"
import { isAuthConfigured } from "@/lib/auth"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; denied?: string | string[] }>
}) {
  // No OAuth application means there is no admin to sign in to. 404 rather than a
  // sign-in button that cannot work, and rather than an error page that would
  // advertise a half-configured deployment.
  if (!isAuthConfigured()) notFound()

  if (await getAuthor()) redirect("/admin")

  const { error, denied } = await searchParams
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
        <Link prefetch={false} href="/" className={`${controlClassNames} px-5 py-3`}>
          <House className="h-4 w-4" aria-hidden />
          Back to site
        </Link>
      </div>
    </AdminShell>
  )
}
