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
import { SidebarInfo } from "@/features/resume/components/sidebar-info"
import { User } from "lucide-react"

export function PersonalInfoDrawer() {
  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open personal information"
        >
          <User className="h-5 w-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="w-full rounded-none border-l-2 border-border sm:max-w-xl">
        <DrawerHeader className="border-b-2 border-border bg-muted/45">
          <DrawerTitle className="font-black uppercase tracking-tight">
            Personal Information
          </DrawerTitle>
          <DrawerDescription className="text-xs font-semibold">
            Profile, capabilities, education, certifications, and additional background
          </DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-4 pt-6">
          <SidebarInfo />
        </div>
        <DrawerFooter className="border-t-2 border-border">
          <DrawerClose asChild>
            <Button
              variant="ghost"
              className="font-bold"
            >
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
