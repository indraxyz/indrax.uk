import { Link, useLocation } from "react-router"
import type { ReactNode } from "react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { SITE_CONTAINER_CLASS } from "@/components/site-container"
import { focusControlClassNames } from "@/components/ui/variants"
import { cn } from "@/lib/utils"
import { AdminNavigation } from "@/admin/components/layout/admin-navigation"

interface AdminShellProps {
  title: string
  children: ReactNode
  actions?: ReactNode
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
  backLink,
  activePage,
  signedIn = true,
}: AdminShellProps) {
  const { pathname } = useLocation()
  const currentPage = signedIn
    ? pathname.startsWith("/admin/posts")
      ? "posts"
      : pathname === "/admin" || pathname === "/admin/"
        ? "home"
        : activePage
    : undefined

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header
        data-admin-header
        className="sticky top-0 z-50 border-b-2 border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85"
      >
        <div className={`${SITE_CONTAINER_CLASS} py-4`}>
          <div className="flex items-center justify-between gap-4">
            <Link
              to="/admin"
              className={cn(
                "text-lg font-black uppercase tracking-tight text-foreground sm:text-xl",
                focusControlClassNames
              )}
            >
              Indra&apos;s Admin
            </Link>

            <AdminNavigation activePage={currentPage} signedIn={signedIn} />
          </div>
        </div>
      </header>

      <main className={`${SITE_CONTAINER_CLASS} flex-1 space-y-8 py-10 lg:py-14`}>
        <div className="space-y-4">
          {(!signedIn || currentPage !== "home") && (
            <Breadcrumb
              items={
                signedIn
                  ? [
                      { name: "Admin", path: "/admin" },
                      ...(backLink ? [{ name: backLink.label, path: backLink.href }] : []),
                      { name: title },
                    ]
                  : [{ name: "Home", path: "/", reloadDocument: true }, { name: title }]
              }
            />
          )}
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
        <div className="mt-12 flex items-center justify-between gap-3 border-t-2 border-border py-10">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">
            Administrator
          </p>
          <ThemeToggle />
        </div>
      </footer>
    </div>
  )
}
