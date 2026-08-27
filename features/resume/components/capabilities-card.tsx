import { Award } from "lucide-react"
import { SectionCard } from "@/components/ui/section-card"
import { techSkills } from "@/features/resume/data/resume"

export function CapabilitiesCard() {
  return (
    <SectionCard
      icon={<Award className="h-5 w-5" />}
      title="Capabilities"
      tone="tertiary"
      height="lg"
    >
      <ul className="space-y-3">
        {techSkills.map((skill) => (
          <li key={skill} className="flex items-start gap-3">
            <span className="variant-tertiary mt-1.5 h-2 w-2 shrink-0 rounded-none bg-[var(--variant-bg)]" />
            <span className="text-sm font-medium leading-relaxed">{skill}</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
