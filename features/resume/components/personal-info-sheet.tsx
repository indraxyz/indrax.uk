import { useRef } from "react"
import { ScrollHeader } from "@/components/scroll-header"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ProfileAvatar } from "@/features/resume/components/profile-avatar"
import { SidebarInfo } from "@/features/resume/components/sidebar-info"
import { personalInfo } from "@/features/resume/data/resume"
import { UserRound, X } from "lucide-react"

export function PersonalInfoSheet() {
  const scrollTargetRef = useRef<HTMLDivElement>(null)

  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" />}
        aria-label="Open about me"
        title="About me"
      >
        <UserRound className="h-5 w-5" aria-hidden />
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-none border-border bg-background shadow-soft-lg data-[side=right]:w-full data-[side=right]:border-l-2 data-[side=right]:sm:max-w-xl"
      >
        <SheetClose
          render={
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-3 z-30 bg-background [&_svg]:size-5"
            />
          }
          aria-label="Close about me"
          title="Close about me"
        >
          <X className="h-5 w-5" aria-hidden />
        </SheetClose>
        <div
          ref={scrollTargetRef}
          role="region"
          aria-label="About me details"
          tabIndex={0}
          className="min-h-0 flex-1 overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <ScrollHeader
            scrollTargetRef={scrollTargetRef}
            className="z-10 border-b-0 bg-background supports-backdrop-filter:bg-background"
          >
            <SheetHeader className="border-b-2 border-border bg-muted/45 pe-16">
              <SheetTitle className="font-black uppercase tracking-tight">About me</SheetTitle>
              <SheetDescription className="text-xs font-semibold">
                Profile, capabilities, education, certifications, and additional background
              </SheetDescription>
            </SheetHeader>
          </ScrollHeader>
          <div className="px-4 pb-4 pt-10">
            <div className="mb-10 flex justify-center">
              <ProfileAvatar src="/foto-profile.jpg" alt={personalInfo.name} fallback="ICE" />
            </div>
            <SidebarInfo />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
