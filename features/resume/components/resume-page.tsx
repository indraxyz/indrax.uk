import { ExperienceSection } from "@/features/resume/components/experience-section"
import { HeroSection } from "@/features/resume/components/hero-section"
import { PortfolioSection } from "@/features/resume/components/portfolio-section"
import { PublicShell } from "@/features/resume/components/public-shell"
import { SidebarInfo } from "@/features/resume/components/sidebar-info"
import { TechStackSection } from "@/features/resume/components/tech-stack-section"

export function ResumePage() {
  return (
    <PublicShell activePage="resume">
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
    </PublicShell>
  )
}
