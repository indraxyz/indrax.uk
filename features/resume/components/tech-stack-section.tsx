import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionHeader } from "@/features/resume/components/section-header"
import { techStacks } from "@/features/resume/data/resume"
import { Code } from "lucide-react"

const groupedStacks = techStacks.reduce(
  (acc, stack) => {
    const group = stack.group || "Other"
    if (!acc[group]) {
      acc[group] = []
    }
    acc[group].push(stack)
    return acc
  },
  {} as Record<string, typeof techStacks>
)

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

function getGroupOrder(groupName: string) {
  const index = groupOrder.indexOf(groupName as (typeof groupOrder)[number])
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER
}

const orderedGroupedStacks = Object.entries(groupedStacks).sort(
  ([groupA], [groupB]) => getGroupOrder(groupA) - getGroupOrder(groupB)
)

export function TechStackSection() {
  return (
    <Card className="variant-primary variant-surface bg-[var(--variant-soft)]">
      <CardHeader className="variant-surface-header border-b-2">
        <SectionHeader
          icon={<Code className="h-5 w-5" />}
          title="Tech Stack"
          subtitle="A structured view of the technologies, platforms, and engineering practices used to design, build, operate, and improve digital products."
          variant="primary"
        />
      </CardHeader>
      <CardContent className="flex gap-6 overflow-x-auto pb-6 pt-6">
        {orderedGroupedStacks.map(([groupName, stacks]) => (
          <Card
            key={groupName}
            className="variant-secondary variant-border flex w-[350px] max-w-[85vw] shrink-0 flex-col bg-[var(--variant-soft)]"
          >
            <CardHeader className="variant-surface-header border-b-2 pb-4">
              <CardTitle className="text-base font-black uppercase tracking-tight">
                {groupName}
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-72 space-y-5 overflow-y-auto pt-4">
              {stacks.map((stack) => (
                <div key={`${groupName}-${stack.category}`} className="space-y-1.5">
                  <p className="variant-secondary variant-soft-chip inline-block rounded-none border-2 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-foreground">
                    {stack.category}
                  </p>
                  <p className="text-sm font-medium leading-relaxed text-foreground">{stack.items}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  )
}
