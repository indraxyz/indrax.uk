import { Separator } from "@/components/ui/separator"
import { achievements } from "@/features/resume/data/resume"
import { SectionCard } from "@/components/ui/section-card"
import { Award } from "lucide-react"

export function AchievementsCard() {
  return (
    <SectionCard icon={<Award className="h-5 w-5" />} title="Achievements" tone="tertiary">
      <div className="space-y-4 print:space-y-2">
        {achievements.map((achievement, index) => (
          <div key={achievement.title}>
            <p className="mb-1 text-sm font-bold leading-tight">{achievement.title}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {achievement.description}
            </p>
            {achievement.period && (
              <p className="variant-tertiary variant-soft-chip mt-2 inline-block rounded-none border-2 px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-foreground">
                {achievement.period}
              </p>
            )}
            {index < achievements.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
