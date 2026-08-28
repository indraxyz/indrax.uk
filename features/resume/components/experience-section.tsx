import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionCard } from "@/components/ui/section-card"
import { Timeline, TimelineContent, TimelineItem } from "@/components/ui/timeline"
import { SOCIAL_LINKS } from "@/features/resume/config"
import { experiences } from "@/features/resume/data/resume"
import { Briefcase } from "lucide-react"

function ExperienceDetails({
  company,
  period,
  timing,
  role,
  description,
}: (typeof experiences)[number]) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="variant-secondary variant-soft-chip rounded-none border-2 px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-foreground">
          {period}
        </p>
        <Badge variant="secondary" className="px-2 text-xs">
          {role}
        </Badge>
        <span className="text-xs font-black uppercase tracking-widest text-foreground">
          ({timing})
        </span>
      </div>
      <h3 className="text-xl font-black uppercase leading-tight tracking-tight">{company}</h3>
      <ul className="ml-4 list-outside list-disc space-y-2 text-sm text-foreground">
        {description.map((item) => (
          <li key={item} className="leading-relaxed font-medium">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ExperienceSection() {
  return (
    <SectionCard
      variant="ghost"
      icon={<Briefcase className="h-5 w-5" />}
      title="Experiences"
      subtitle="Professional timeline across product engineering, fullstack delivery, and agentic workflow execution."
      link={{ href: SOCIAL_LINKS.linkedin, textLink: "Linkedin" }}
      height="xl"
      contentClassName="pt-8 pb-4 sm:pr-4"
    >
      <div className="hidden sm:block">
        <Timeline>
          {experiences.map((experience, index) => (
            <TimelineItem
              key={`${experience.company}-${experience.period}`}
              isLast={index === experiences.length - 1}
            >
              <TimelineContent>
                <ExperienceDetails {...experience} />
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </div>

      <div className="flex gap-6 overflow-x-auto sm:hidden">
        {experiences.map((experience) => (
          <Card
            key={`${experience.company}-${experience.period}`}
            height="2xl"
            className="variant-secondary variant-border max-w-96 shrink-0 bg-[var(--variant-soft)]"
          >
            <CardHeader className="variant-surface-header border-b-2 pb-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="variant-soft-chip rounded-none border-2 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-foreground">
                  {experience.period}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="tertiary" className="w-fit px-2 text-[10px]">
                  {experience.role}
                </Badge>
                <span className="text-[10px] font-black uppercase tracking-widest text-current">
                  ({experience.timing})
                </span>
              </div>
              <CardTitle className="mt-2 text-lg font-black uppercase leading-tight tracking-tight">
                {experience.company}
              </CardTitle>
            </CardHeader>
            <CardContent scrollable className="pt-4">
              <ul className="ml-4 list-outside list-disc space-y-2 text-sm text-foreground">
                {experience.description.map((item) => (
                  <li key={item} className="leading-relaxed font-medium">
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </SectionCard>
  )
}
