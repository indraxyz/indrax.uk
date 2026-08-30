import { Separator } from "@/components/ui/separator"
import { SectionCard } from "@/components/ui/section-card"
import { certificationGroups } from "@/features/resume/utils/groups"
import { Award, ExternalLink } from "lucide-react"
import Link from "next/link"

export function CertificationsCard() {
  return (
    <SectionCard
      icon={<Award className="h-5 w-5" />}
      title="Certifications"
      tone="tertiary"
      height="lg"
    >
      <div className="space-y-6 print:space-y-3">
        {certificationGroups.map(([groupName, items], groupIndex) => (
          <div key={groupName}>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-foreground">
              {groupName}
            </p>
            <div className="space-y-4 print:space-y-2">
              {items.map((certification) => (
                <div key={`${groupName}-${certification.title}`}>
                  <p className="mb-1 text-sm font-bold leading-tight">{certification.title}</p>
                  {certification.link && (
                    <Link
                      href={certification.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider hover:underline"
                    >
                      View Certificate <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                  {certification.period && (
                    <p className="variant-tertiary variant-soft-chip mt-2 inline-block rounded-none border-2 px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-foreground">
                      {certification.period}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {groupIndex < certificationGroups.length - 1 && <Separator className="mt-6" />}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
