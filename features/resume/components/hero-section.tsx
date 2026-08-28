import { Card, CardContent } from "@/components/ui/card"
import { HighlightSkills } from "@/features/resume/components/highlight-skills"
import { bio, personalInfo } from "@/features/resume/data/resume"

export function HeroSection() {
  const firstName = personalInfo.name.trim().split(/\s+/)[0]

  return (
    <Card className="variant-primary variant-surface mb-8 overflow-hidden bg-[var(--variant-soft)]">
      <CardContent className="relative p-8 lg:p-12">
        <div className="space-y-6 text-center sm:text-left">
          <div className="space-y-2">
            <h1 className="text-4xl font-black uppercase tracking-tight text-foreground md:text-5xl">
              {firstName}
            </h1>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--variant-border)] md:text-base">
              {personalInfo.title}
            </p>
          </div>
          <HighlightSkills skills={personalInfo.highlightSkills ?? []} />
          <p className="mx-auto max-w-5xl text-base leading-relaxed text-foreground sm:mx-0 md:text-lg">
            {bio}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
