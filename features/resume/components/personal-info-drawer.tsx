"use client"

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
import { ProfileAvatar } from "@/features/resume/components/profile-avatar"
import { SidebarInfo } from "@/features/resume/components/sidebar-info"
import { personalInfo } from "@/features/resume/data/resume"
import { User, X } from "lucide-react"

export function PersonalInfoDrawer() {
  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open personal information">
          <User className="h-5 w-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="w-full rounded-none border-l-2 border-border sm:max-w-xl">
        <DrawerHeader className="border-b-2 border-border bg-muted/45">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5 md:gap-1.5">
              <DrawerTitle className="font-black uppercase tracking-tight">
                Personal Information
              </DrawerTitle>
              <DrawerDescription className="text-xs font-semibold">
                Profile, capabilities, education, certifications, and additional background
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close personal information"
                className="-mr-2 shrink-0 sm:hidden"
              >
                <X className="h-5 w-5" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-4 pt-10">
          <div className="mb-10 flex justify-center">
            <ProfileAvatar src="/foto-profile.jpg" alt={personalInfo.name} fallback="ICE" />
          </div>
          <SidebarInfo />
        </div>
        <DrawerFooter className="hidden border-t-2 border-border sm:flex">
          <DrawerClose asChild>
            <Button variant="ghost" className="font-bold">
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
