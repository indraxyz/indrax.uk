import Image from "next/image"

import { Card, CardContent } from "@/components/ui/card"
import { ContactLinks } from "@/features/resume/components/contact-links"
import { DownloadResumeButton } from "@/features/resume/components/download-resume-button"
import { HighlightSkills } from "@/features/resume/components/highlight-skills"
import { PersonalInfoDrawer } from "@/features/resume/components/personal-info-drawer"
import { bio, personalInfo } from "@/features/resume/data/resume"
import { SITE_CONTAINER_CLASS } from "@/components/site-container"
import { cn } from "@/lib/utils"

export function HeroSection({
  fullWidth = false,
  showSkills = true,
}: {
  fullWidth?: boolean
  showSkills?: boolean
}) {
  const firstName = personalInfo.name.trim().split(/\s+/)[0]

  return (
    <Card
      variant={fullWidth ? "ghost" : "card"}
      className={cn(
        "variant-primary variant-surface mb-8 overflow-hidden bg-[var(--variant-soft)]",
        fullWidth && "w-full shadow-none"
      )}
    >
      <CardContent
        className={cn(
          "relative p-8 print:p-4 lg:p-12",
          fullWidth && `${SITE_CONTAINER_CLASS} !px-4 py-8 lg:py-12`
        )}
      >
        <div className="print:flex print:items-stretch print:gap-4">
          {/* On screen the photo lives in the drawer. Paper has no drawer to open,
              so the hero carries it: a plain rectangle sized to the block beside
              it, cropped rather than letterboxed. */}
          <div
            data-print-clip
            className="relative hidden w-36 shrink-0 self-stretch overflow-hidden border-2 border-[var(--variant-border)] print:block"
          >
            <Image
              src="/foto-profile.jpg"
              alt={personalInfo.name}
              fill
              // It occupies ~25mm on the sheet, so 320px lands just past 300dpi:
              // sharp in print without the file weight of a larger source.
              sizes="320px"
              // Above the fold and the only image on the printed sheet: lazy
              // loading risks the print starting before it decodes.
              priority
              className="object-cover object-center"
            />
          </div>

          <div className="space-y-6 text-center print:space-y-3 sm:text-left">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-2 print:space-y-1 sm:flex-1">
                <h1 className="text-4xl font-black uppercase tracking-tight text-foreground print:text-3xl md:text-5xl">
                  {firstName}
                </h1>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--variant-border)] print:text-xs md:text-base">
                  {personalInfo.title}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 print:hidden">
                <PersonalInfoDrawer />
                <DownloadResumeButton />
              </div>
            </div>
            {showSkills && <HighlightSkills skills={personalInfo.highlightSkills ?? []} />}
            <p className="mx-auto max-w-5xl text-base leading-relaxed text-foreground print:text-sm print:leading-snug sm:mx-0 md:text-lg">
              {bio}
            </p>
            <ContactLinks />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
