import { BuildProcessSection } from "@/features/home/components/build-process-section"
import { WritingSection } from "@/features/home/components/writing-section"
import { HeroSection } from "@/features/resume/components/hero-section"
import { PublicShell } from "@/components/layout/public-shell"
import { SITE_CONTAINER_CLASS } from "@/components/site-container"

export function HomePage() {
  return (
    <PublicShell activePage="home" fullWidth>
      <HeroSection fullWidth showSkills={false} />
      <div className={SITE_CONTAINER_CLASS}>
        <BuildProcessSection />
        <WritingSection />
      </div>
    </PublicShell>
  )
}
