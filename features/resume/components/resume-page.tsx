import { RESUME_CONFIG } from "@/features/resume/config"
import { ExperienceSection } from "@/features/resume/components/experience-section"
import { HeroSection } from "@/features/resume/components/hero-section"
import { PersonalInfoDrawer } from "@/features/resume/components/personal-info-drawer"
import { PortfolioSection } from "@/features/resume/components/portfolio-section"
import { TechStackSection } from "@/features/resume/components/tech-stack-section"
import { getCurrentDateFormatted } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"

export function ResumePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-50 border-b-2 border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85">
        <div className="container mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-lg font-black uppercase tracking-tight text-foreground sm:text-xl">
              {RESUME_CONFIG.title}
            </p>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <PersonalInfoDrawer />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 py-10 print:py-4 xl:py-14">
        <HeroSection />

        <div className="space-y-8">
          <ExperienceSection />
          <TechStackSection />
          <PortfolioSection />
        </div>

        <div className="mt-12 border-t-2 border-border py-10 text-center">
          <p className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">
            updated at {getCurrentDateFormatted()}
          </p>
        </div>
      </div>
    </div>
  )
}
