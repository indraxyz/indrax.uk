import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cardFeedbackClassNames,
} from "@/components/ui/card"
import { SectionCard } from "@/components/ui/section-card"
import { SECTION_COPY } from "@/features/resume/data/page"
import { techStackGroups } from "@/features/resume/utils/groups"
import { RAIL_CARD_WIDTH } from "@/components/ui/card-rail"
import { cn } from "@/lib/utils"
import { Code } from "lucide-react"

export function TechStackSection() {
  return (
    <SectionCard
      variant="ghost"
      icon={<Code className="h-5 w-5" />}
      title="Tech Stack"
      subtitle={SECTION_COPY.techStack}
      carousel
      carouselFullBleed
      className="w-full"
    >
      {techStackGroups.map(([groupName, stacks]) => (
        <Card
          key={groupName}
          height="2xl"
          className={cn(
            "variant-secondary variant-border bg-[var(--variant-soft)]",
            RAIL_CARD_WIDTH,
            cardFeedbackClassNames
          )}
        >
          <CardHeader className="variant-surface-header border-b-2 pb-4">
            <CardTitle className="text-lg leading-snug">{groupName}</CardTitle>
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
