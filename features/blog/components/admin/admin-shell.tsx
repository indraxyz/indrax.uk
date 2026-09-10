import { ArrowLeft, LogOut } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { ThemeToggle } from "@/components/theme-toggle"
import { controlClassNames } from "@/components/ui/variants"
import { SignOutButton } from "@/features/blog/components/admin/sign-out-button"
import { BLOG_CONFIG } from "@/features/blog/config"
import { cn } from "@/lib/utils"

interface AdminShellProps {
  title: string
  children: ReactNode
  actions?: ReactNode
  /** Omitted on the login page, which has nobody to sign out. */
  signedIn?: boolean
}

/**
 * The chrome every admin page sits in.
 *
 * Deliberately plainer than `BlogShell`: this is a workbench, not a published
 * page, and the difference should be visible at a glance so there is never a
 * question about which one is being looked at.
 */
export function AdminShell({ title, children, actions, signedIn = true }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b-2 border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85">
        <div className="container mx-auto max-w-6xl px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-baseline gap-3">
              <p className="text-lg font-black uppercase tracking-tight text-foreground sm:text-xl">
                {title}
              </p>
              <Link
                href={BLOG_CONFIG.basePath}
                className="flex items-center gap-1 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3 w-3" aria-hidden />
                View site
              </Link>
            </div>

            <div className="flex items-center gap-2">
              {actions}
              <ThemeToggle />
              {signedIn && (
                <SignOutButton className={cn(controlClassNames, "px-3 py-2")}>
                  <LogOut className="h-3.5 w-3.5" aria-hidden />
                  Sign out
                </SignOutButton>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-6xl space-y-6 px-4 py-10">{children}</main>
    </div>
  )
}
