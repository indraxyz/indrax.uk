import { Award } from "lucide-react"
import { SidebarSectionCard } from "@/features/resume/components/sidebar-section-card"
import { techSkills } from "@/features/resume/data/resume"

export function CapabilitiesCard() {
  return (
    <SidebarSectionCard
      icon={<Award className="h-5 w-5" />}
      title="Capabilities"
      variant="tertiary"
    >
      <div className="max-h-[32rem] min-h-[16rem] overflow-y-auto pr-2">
        <ul className="space-y-3">
          {techSkills.map((skill) => (
            <li key={skill} className="flex items-start gap-3">
              <span className="variant-tertiary mt-1.5 h-2 w-2 shrink-0 rounded-none bg-[var(--variant-bg)]" />
              <span className="text-sm font-medium leading-relaxed">{skill}</span>
            </li>
          ))}
        </ul>
      </div>
    </SidebarSectionCard>
  )
}
