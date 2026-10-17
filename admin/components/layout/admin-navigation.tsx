import { Menu as DropdownMenu } from "@base-ui/react/menu"
import { ChevronDown, FileText, Globe, House, LogOut, Menu, X } from "lucide-react"
import { Link } from "react-router"
import { useEffect, useRef, useState } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
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
import { navigationLinkClassNames } from "@/components/ui/navigation-link"
import { controlClassNames } from "@/components/ui/variants"
import { SignOutButton } from "@/admin/components/auth/sign-out-button"
import { WRITING_CONFIG } from "@/features/writing/config"
import { cn } from "@/lib/utils"

const links = [
  { href: "/admin", label: "Dashboard", page: "home", icon: House },
  { href: "/admin/posts", label: "Posts", page: "posts", icon: FileText },
] as const

const publicLinks = [
  { href: "/resume", label: "Resume" },
  { href: WRITING_CONFIG.basePath, label: WRITING_CONFIG.title },
  { href: "/tech-stack", label: "Stack" },
] as const

function PublicMenu({
  onNavigate,
  inSheet = false,
}: {
  onNavigate?: () => void
  inSheet?: boolean
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className={
          inSheet
            ? cn(controlClassNames, "min-h-12 w-full px-4 py-3 text-left")
            : cn(navigationLinkClassNames, "gap-1.5")
        }
      >
        {inSheet && <Globe className="h-4 w-4" aria-hidden />}
        Public
        <ChevronDown className={cn("h-3.5 w-3.5", inSheet && "ml-auto")} aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Positioner align="end" sideOffset={8} className="z-[70]">
          <DropdownMenu.Popup className="min-w-48 border-2 border-border bg-card p-1 text-card-foreground shadow-soft-lg outline-none">
            {publicLinks.map(({ href, label }) => (
              <DropdownMenu.Item
                key={href}
                render={<a href={href} target="_blank" rel="noopener noreferrer" />}
                onClick={onNavigate}
                className="flex min-h-11 items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] outline-none data-highlighted:bg-muted"
              >
                {label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Popup>
        </DropdownMenu.Positioner>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

interface AdminNavigationProps {
  activePage?: "home" | "posts"
  signedIn: boolean
}

export function AdminNavigation({ activePage, signedIn }: AdminNavigationProps) {
  const [open, setOpen] = useState(false)
  const desktopNavigation = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const navigation = desktopNavigation.current
    if (!navigation) return
    // Follow the actual CSS breakpoint instead of duplicating it in JavaScript.
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setOpen(false)
    })
    observer.observe(navigation)
    return () => observer.disconnect()
  }, [signedIn])

  if (!signedIn) return null

  return (
    <div className="flex items-center gap-2">
      <div ref={desktopNavigation} className="hidden items-center gap-2 md:flex">
        <nav aria-label="Admin" className="mr-1 flex items-center gap-4">
          {links.map(({ href, label, page, icon: Icon }) => (
            <Link
              key={href}
              to={href}
              aria-label={label}
              aria-current={activePage === page ? "page" : undefined}
              title={label}
              className={cn(navigationLinkClassNames, page === "home" && "min-w-11")}
            >
              {page === "home" ? <Icon className="h-4 w-4" aria-hidden /> : label}
            </Link>
          ))}
          <PublicMenu />
        </nav>
        <SignOutButton className={buttonVariants({ variant: "ghost", size: "icon" })}>
          <LogOut className="h-3.5 w-3.5" aria-hidden />
        </SignOutButton>
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
                <DrawerDescription>Manage your site.</DrawerDescription>
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
            <nav aria-label="Admin" className="flex flex-col gap-2">
              {links.map(({ href, label, page, icon: Icon }) => (
                <Link
                  key={href}
                  to={href}
                  onClick={() => setOpen(false)}
                  aria-current={activePage === page ? "page" : undefined}
                  className={cn(
                    controlClassNames,
                    "min-h-12 px-4 py-3 aria-[current=page]:border-ring aria-[current=page]:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </Link>
              ))}
              <PublicMenu inSheet onNavigate={() => setOpen(false)} />
            </nav>
          </div>

          <DrawerFooter className="shrink-0 gap-3 border-t-2 border-border pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <SignOutButton
              className={buttonVariants({
                variant: "primary",
                appearance: "flat",
                size: "lg",
                className: "w-full",
              })}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </SignOutButton>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
