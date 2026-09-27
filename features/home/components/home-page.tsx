import { BuildProcessSection } from "@/features/home/components/build-process-section"
import { WritingSection } from "@/features/home/components/writing-section"
import { HeroSection } from "@/features/resume/components/hero-section"
import { PublicShell } from "@/features/resume/components/public-shell"

export function HomePage() {
  return (
    <PublicShell activePage="home">
      <HeroSection />
      <BuildProcessSection />
      <WritingSection />
    </PublicShell>
  )
}
