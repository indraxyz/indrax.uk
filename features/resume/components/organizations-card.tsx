import { Separator } from "@/components/ui/separator"
import { organizations } from "@/features/resume/data/resume"
import { SectionCard } from "@/components/ui/section-card"
import { Users } from "lucide-react"

export function OrganizationsCard() {
  if (organizations.length === 0) {
    return null
  }

  return (
    <SectionCard icon={<Users className="h-5 w-5" />} title="Organizations" tone="tertiary">
      <div className="space-y-4 print:space-y-2">
        {organizations.map((organization, index) => (
          <div key={`${organization.title}-${organization.period}`}>
            <p className="mb-1 text-sm font-bold leading-tight">{organization.title}</p>
            {organization.description && (
              <p className="mb-1 text-xs leading-relaxed text-muted-foreground">
                {organization.description}
              </p>
            )}
            <p className="variant-tertiary variant-soft-chip mt-2 inline-block rounded-none border-2 px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-foreground">
              {organization.period}
            </p>
            {index < organizations.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
