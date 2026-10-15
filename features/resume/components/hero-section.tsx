import { Card, CardContent } from "@/components/ui/card"
import { ContactLinks } from "@/features/resume/components/contact-links"
import { DownloadResumeButton } from "@/features/resume/components/download-resume-button"
import { HighlightSkills } from "@/features/resume/components/highlight-skills"
import { PersonalInfoSheet } from "@/features/resume/components/personal-info-sheet"
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
          "relative p-4 sm:p-8 print:p-4 lg:p-12",
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
            <img
              src="/foto-profile.jpg"
              alt={personalInfo.name}
              width={320}
              height={400}
              // It occupies ~25mm on the sheet, so 320px lands just past 300dpi:
              // sharp in print without the file weight of a larger source.
              sizes="320px"
              // Above the fold and the only image on the printed sheet: lazy
              // loading risks the print starting before it decodes.
              loading="eager"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          </div>

          <div className="min-w-0 flex-1 space-y-6 text-center print:space-y-3 sm:text-left">
            <h1 className="text-[clamp(1.5rem,calc(1rem+2.5vw),2.5rem)] font-black uppercase leading-tight tracking-tight text-foreground print:text-3xl">
              Software Engineer
            </h1>
            {showSkills && <HighlightSkills skills={personalInfo.highlightSkills ?? []} />}
            <p className="mx-auto max-w-5xl text-base leading-relaxed text-foreground print:text-sm print:leading-snug sm:mx-0 md:text-lg">
              {bio}
            </p>
            <div className="flex items-center justify-between gap-4 print:hidden">
              <ContactLinks />
              <div className="flex shrink-0 items-center gap-2">
                <PersonalInfoSheet />
                <DownloadResumeButton />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
