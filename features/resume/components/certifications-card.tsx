import { Separator } from "@/components/ui/separator"
import { certifications } from "@/features/resume/data/resume"
import { SectionCard } from "@/components/ui/section-card"
import { groupInOrder } from "@/lib/utils"
import { Award, ExternalLink } from "lucide-react"
import Link from "next/link"

const groupOrder = [
  "Claude by Anthropic",
  "ChatGPT/Codex by OpenAI",
  "AI Automations by MySkill",
] as const

// A certificate without an explicit group stands under its own issuer, so the
// heading always names who issued the items beneath it.
const groupedCertifications = groupInOrder(
  certifications,
  (certification) => certification.group ?? certification.issuer,
  groupOrder
)

export function CertificationsCard() {
  return (
    <SectionCard
      icon={<Award className="h-5 w-5" />}
      title="Certifications"
      tone="tertiary"
      height="lg"
    >
      <div className="space-y-6 print:space-y-3">
        {groupedCertifications.map(([groupName, items], groupIndex) => (
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
            {groupIndex < groupedCertifications.length - 1 && <Separator className="mt-6" />}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
