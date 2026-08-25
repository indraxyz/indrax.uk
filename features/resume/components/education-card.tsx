import { Separator } from "@/components/ui/separator"
import { education } from "@/features/resume/data/resume"
import { SectionCard } from "@/components/ui/section-card"
import { GraduationCap } from "lucide-react"

export function EducationCard() {
  return (
    <SectionCard icon={<GraduationCap className="h-5 w-5" />} title="Education" tone="tertiary">
      <div className="space-y-6">
        {education.map((item, index) => (
          <div key={`${item.institution}-${item.period}`} className="space-y-3">
            <div>
              <p className="mb-1 text-sm font-bold uppercase tracking-wider">{item.degree}</p>
              <p className="text-sm font-medium">{item.institution}</p>
              <p className="mb-1 text-sm text-muted-foreground">{item.field}</p>
              <p className="variant-tertiary variant-soft-chip mt-1 inline-block rounded-none border-2 px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-foreground">
                {item.period}
                {item.gpa && ` • GPA: ${item.gpa}`}
              </p>
            </div>
            {item.thesis && (
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider">Thesis:</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{item.thesis}</p>
              </div>
            )}
            {item.organization && item.organization.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wider">Organizations:</p>
                <ul className="ml-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {item.organization.map((organization) => (
                    <li key={organization}>{organization}</li>
                  ))}
                </ul>
              </div>
            )}
            {item.description && (
              <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
            )}
            {index < education.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
