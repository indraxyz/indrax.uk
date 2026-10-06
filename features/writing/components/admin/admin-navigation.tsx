"use client"

import { FileText, House, LogOut, Menu, PencilLine, UserRound, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { controlClassNames } from "@/components/ui/variants"
import { SignOutButton } from "@/features/writing/components/admin/sign-out-button"
import { WRITING_CONFIG } from "@/features/writing/config"
import { cn } from "@/lib/utils"

const links = [
  { href: "/admin", label: "Admin home", page: "home", icon: House },
  { href: "/admin/posts", label: "Posts", page: "posts", icon: FileText },
  { href: "/resume", label: "Resume", page: null, icon: UserRound },
  { href: WRITING_CONFIG.basePath, label: WRITING_CONFIG.title, page: null, icon: PencilLine },
] as const

interface AdminNavigationProps {
  activePage?: "home" | "posts"
  signedIn: boolean
}

export function AdminNavigation({ activePage, signedIn }: AdminNavigationProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)")
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false)
    }
    desktop.addEventListener("change", closeOnDesktop)
    return () => desktop.removeEventListener("change", closeOnDesktop)
  }, [])

  return (
    <>
      <div className="hidden items-center gap-2 md:flex">
        {signedIn && (
          <nav aria-label="Admin" className="mr-1 flex items-center gap-4">
            {links.map(({ href, label, page, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-label={label}
                title={page === "home" ? label : undefined}
                aria-current={activePage === page ? "page" : undefined}
                className="inline-flex min-h-11 items-center text-xs font-black uppercase tracking-[0.14em] text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {page === "home" ? <Icon className="h-4 w-4" aria-hidden /> : label}
              </Link>
            ))}
          </nav>
        )}
        <ThemeToggle />
        {signedIn && (
          <SignOutButton className={cn(controlClassNames, "min-h-11 px-3 py-2")}>
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Sign out
          </SignOutButton>
        )}
      </div>

      <Drawer swipeDirection="right" open={open} onOpenChange={setOpen}>
        <DrawerTrigger
          render={<Button variant="ghost" size="icon" className="md:hidden" />}
          aria-label="Open admin menu"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </DrawerTrigger>
        <DrawerContent className="border-2 border-border bg-background shadow-soft-lg data-[swipe-direction=right]:rounded-none data-[swipe-axis=x]:[--drawer-content-width:88%] data-[swipe-axis=x]:sm:[--drawer-content-width:24rem]">
          <DrawerHeader className="shrink-0 border-b-2 border-border bg-muted/45 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <DrawerTitle className="font-black uppercase tracking-tight">
                  Admin menu
                </DrawerTitle>
                <DrawerDescription>
                  {signedIn ? "Manage your site and preferences." : "Site preferences."}
                </DrawerDescription>
              </div>
              <DrawerClose
                render={<Button variant="ghost" size="icon" className="shrink-0" />}
                aria-label="Close admin menu"
              >
                <X className="h-5 w-5" aria-hidden />
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {signedIn && (
              <nav aria-label="Admin" className="flex flex-col gap-2">
                {links.map(({ href, label, page, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={activePage === page ? "page" : undefined}
                    className={cn(
                      controlClassNames,
                      "min-h-12 px-4 py-3",
                      activePage === page && "bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {label}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          <DrawerFooter className="shrink-0 gap-3 border-t-2 border-border pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-xs font-black uppercase tracking-[0.14em]">Theme</span>
              <ThemeToggle />
            </div>
            {signedIn && (
              <SignOutButton
                className={cn(controlClassNames, "min-h-12 w-full justify-center px-4 py-3")}
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </SignOutButton>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}
