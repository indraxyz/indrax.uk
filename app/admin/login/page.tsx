import { notFound, redirect } from "next/navigation"

import { AdminShell } from "@/features/blog/components/admin/admin-shell"
import { SignInButton } from "@/features/blog/components/admin/sign-in-button"
import { getAuthor } from "@/lib/auth-guard"
import { isAuthConfigured } from "@/lib/auth"

export default async function LoginPage() {
  // No OAuth application means there is no admin to sign in to. 404 rather than a
  // sign-in button that cannot work, and rather than an error page that would
  // advertise a half-configured deployment.
  if (!isAuthConfigured()) notFound()

  if (await getAuthor()) redirect("/admin")

  return (
    <AdminShell title="Sign in" signedIn={false}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-6 border-2 border-border bg-card px-6 py-16 text-center shadow-soft">
        <h1 className="text-2xl font-black uppercase tracking-tight">Author access</h1>

        <p className="text-sm font-semibold leading-relaxed text-muted-foreground">
          One GitHub account can sign in here. Anything else is refused before a session exists.
        </p>

        <SignInButton />
      </div>
    </AdminShell>
  )
}
