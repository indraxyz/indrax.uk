import { RESUME_CONFIG, SITE_URL, SOCIAL_LINKS } from "@/features/resume/config"
import { DownloadResumeButton } from "@/features/resume/components/download-resume-button"
import { ExperienceSection } from "@/features/resume/components/experience-section"
import { HeroSection } from "@/features/resume/components/hero-section"
import { PersonalInfoDrawer } from "@/features/resume/components/personal-info-drawer"
import { PortfolioSection } from "@/features/resume/components/portfolio-section"
import { SidebarInfo } from "@/features/resume/components/sidebar-info"
import { TechStackSection } from "@/features/resume/components/tech-stack-section"
import { formatDate } from "@/lib/utils"
import { GithubIcon } from "@/components/ui/github-icon"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import Link from "next/link"

// Derived from the configured origin so the credit cannot drift from the
// canonical URL the metadata advertises.
const SITE_HOST = new URL(SITE_URL).host

export function ResumePage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b-2 border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85 print:static print:bg-transparent print:backdrop-blur-none">
        <div className="container mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="text-lg font-black uppercase tracking-tight text-foreground sm:text-xl">
              {RESUME_CONFIG.title}
            </p>
            <div className="flex items-center gap-2 print:hidden">
              <Button asChild variant="ghost" size="icon" aria-label="GitHub profile">
                <Link href={SOCIAL_LINKS.github} target="_blank" rel="noopener noreferrer">
                  <GithubIcon className="h-5 w-5" />
                </Link>
              </Button>
              <ThemeToggle />
              <PersonalInfoDrawer />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl px-4 py-10 print:py-4 lg:py-14">
        <HeroSection />

        {/* On screen this content lives in the drawer, which unmounts while closed
            and so never reaches the printer. Paper has no drawer, so print gets its
            own copy and the sheet carries the whole resume. */}
        <aside className="mb-4 hidden print:block">
          <SidebarInfo />
        </aside>

        <div className="space-y-8 print:space-y-4">
          <ExperienceSection />
          <TechStackSection />
          <PortfolioSection />
        </div>
      </main>

      <footer className="container mx-auto max-w-7xl px-4">
        <div className="mt-12 flex items-center justify-center gap-3 border-t-2 border-border py-10 text-center print:mt-4 print:py-3">
          <DownloadResumeButton />
          <p className="text-sm font-black uppercase tracking-[0.14em] text-muted-foreground">
            Updated {formatDate(RESUME_CONFIG.updatedAt)} &middot; {SITE_HOST}
          </p>
        </div>
      </footer>
    </div>
  )
}
