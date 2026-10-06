"use client"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ProfileAvatar } from "@/features/resume/components/profile-avatar"
import { SidebarInfo } from "@/features/resume/components/sidebar-info"
import { personalInfo } from "@/features/resume/data/resume"
import { UserRound, X } from "lucide-react"

export function PersonalInfoSheet() {
  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" />}
        aria-label="Open personal information"
      >
        <UserRound className="h-5 w-5" aria-hidden />
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="gap-0 rounded-none border-border bg-background shadow-soft-lg data-[side=right]:w-full data-[side=right]:border-l-2 data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader className="shrink-0 border-b-2 border-border bg-muted/45">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5 md:gap-1.5">
              <SheetTitle className="font-black uppercase tracking-tight">
                Personal Information
              </SheetTitle>
              <SheetDescription className="text-xs font-semibold">
                Profile, capabilities, education, certifications, and additional background
              </SheetDescription>
            </div>
            <SheetClose
              render={<Button variant="ghost" size="icon" className="-mr-2 shrink-0 sm:hidden" />}
              aria-label="Close personal information"
            >
              <X className="h-5 w-5" aria-hidden />
            </SheetClose>
          </div>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-10">
          <div className="mb-10 flex justify-center">
            <ProfileAvatar src="/foto-profile.jpg" alt={personalInfo.name} fallback="ICE" />
          </div>
          <SidebarInfo />
        </div>
        <SheetFooter className="hidden shrink-0 border-t-2 border-border pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex">
          <SheetClose render={<Button variant="ghost" className="font-bold" />}>Close</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
