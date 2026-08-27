import { Separator } from "@/components/ui/separator"
import { certifications } from "@/features/resume/data/resume"
import { SectionCard } from "@/components/ui/section-card"
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
      <div className="space-y-4">
        {certifications.map((certification, index) => (
          <div key={`${certification.title}-${certification.period}`}>
            <p className="mb-1 text-sm font-bold leading-tight">{certification.title}</p>
            <p className="mb-1 text-xs font-medium text-muted-foreground">{certification.issuer}</p>
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
            <p className="variant-tertiary variant-soft-chip mt-2 inline-block rounded-none border-2 px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-foreground">
              {certification.period}
            </p>
            {index < certifications.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
