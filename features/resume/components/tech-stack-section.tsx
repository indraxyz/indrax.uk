import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionCard } from "@/components/ui/section-card"
import { techStacks } from "@/features/resume/data/resume"
import { groupInOrder } from "@/lib/utils"
import { Code } from "lucide-react"

const groupOrder = [
  "Languages & Web Foundations",
  "Frontend Engineering",
  "Backend & API Engineering",
  "Data & Storage",
  "Architecture & Security",
  "Website Operations",
  "Cloud & Delivery",
  "Quality & Observability",
  "Integrations & Growth",
  "Mobile & Specialized Product UI",
  "AI & Automation",
  "Design & Product Experience",
  "Project Management & Collaboration",
] as const

const orderedGroupedStacks = groupInOrder(techStacks, (stack) => stack.group || "Other", groupOrder)

export function TechStackSection() {
  return (
    <SectionCard
      variant="ghost"
      icon={<Code className="h-5 w-5" />}
      title="Tech Stack"
      subtitle="A structured view of the technologies, platforms, and engineering practices used to design, build, operate, and improve digital products."
      carousel
    >
      {orderedGroupedStacks.map(([groupName, stacks]) => (
        <Card
          key={groupName}
          height="2xl"
          className="variant-secondary variant-border w-[350px] max-w-[85vw] shrink-0 bg-[var(--variant-soft)]"
        >
          <CardHeader className="variant-surface-header border-b-2 pb-4">
            <CardTitle className="text-base font-black uppercase tracking-tight">
              {groupName}
            </CardTitle>
          </CardHeader>
          <CardContent
            scrollable
            aria-label={groupName}
            className="space-y-5 pt-4 print:space-y-2 print:pt-2"
          >
            {stacks.map((stack) => (
              <div key={`${groupName}-${stack.category}`} className="space-y-1.5 print:space-y-0.5">
                <p className="variant-secondary variant-soft-chip inline-block rounded-none border-2 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-foreground">
                  {stack.category}
                </p>
                <p className="text-sm font-medium leading-relaxed text-foreground print:leading-snug">
                  {stack.items}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </SectionCard>
  )
}
