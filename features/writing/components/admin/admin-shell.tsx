import { House, LogOut } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { Breadcrumb } from "@/components/ui/breadcrumb"
import { SITE_CONTAINER_CLASS } from "@/components/site-container"
import { ThemeToggle } from "@/components/theme-toggle"
import { controlClassNames } from "@/components/ui/variants"
import { SignOutButton } from "@/features/writing/components/admin/sign-out-button"
import { cn } from "@/lib/utils"

interface AdminShellProps {
  title: string
  children: ReactNode
  actions?: ReactNode
  pageNavigation?: ReactNode
  backLink?: { href: string; label: string }
  activePage?: "home" | "posts"
  /** The login page has no protected navigation or sign-out control. */
  signedIn?: boolean
}

/** Shared admin navigation and page framing. Page controls live beside the page title. */
export function AdminShell({
  title,
  children,
  actions,
  pageNavigation,
  backLink,
  activePage,
  signedIn = true,
}: AdminShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b-2 border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85">
        <div className={`${SITE_CONTAINER_CLASS} py-4`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/admin"
              aria-current={activePage === "home" ? "page" : undefined}
              className="text-lg font-black uppercase tracking-tight text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-xl"
            >
              Indra&apos;s Admin
            </Link>

            <div className="flex flex-wrap items-center gap-2">
              {signedIn && (
                <nav aria-label="Admin" className="mr-1 flex items-center gap-4">
                  <Link
                    href="/admin"
                    aria-label="Admin home"
                    title="Admin home"
                    aria-current={activePage === "home" ? "page" : undefined}
                    className="text-foreground hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <House className="h-4 w-4" aria-hidden />
                  </Link>
                  <Link
                    href="/admin/posts"
                    aria-current={activePage === "posts" ? "page" : undefined}
                    className="text-xs font-black uppercase tracking-[0.14em] text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Posts
                  </Link>
                  <Link
                    href="/resume"
                    className="text-xs font-black uppercase tracking-[0.14em] text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Resume
                  </Link>
                </nav>
              )}
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

      <main className={`${SITE_CONTAINER_CLASS} flex-1 space-y-8 py-10 lg:py-14`}>
        <div className="space-y-4">
          {pageNavigation}
          <Breadcrumb
            items={
              signedIn
                ? [
                    ...(activePage === "home" ? [] : [{ name: "Admin", path: "/admin" }]),
                    ...(backLink ? [{ name: backLink.label, path: backLink.href }] : []),
                    { name: title },
                  ]
                : [{ name: "Home", path: "/" }, { name: title }]
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-2xl font-black uppercase tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            {actions}
          </div>
        </div>
        {children}
      </main>

      <footer className={SITE_CONTAINER_CLASS}>
        <div className="mt-12 flex items-center justify-center border-t-2 border-border py-10 text-center">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">
            Administrator of indrax.uk
          </p>
        </div>
      </footer>
    </div>
  )
}
