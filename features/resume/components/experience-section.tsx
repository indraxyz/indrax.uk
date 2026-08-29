import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SectionCard } from "@/components/ui/section-card"
import { Timeline, TimelineContent, TimelineItem } from "@/components/ui/timeline"
import { SOCIAL_LINKS } from "@/features/resume/config"
import { experiences } from "@/features/resume/data/resume"
import { Briefcase } from "lucide-react"

type Experience = (typeof experiences)[number]

const experienceKey = (experience: Experience) => `${experience.company}-${experience.period}`

// The timeline and the mobile rail lay the same facts out differently, but the
// bullet list itself is identical in both, so it lives here once.
function ExperienceDescription({ description }: Pick<Experience, "description">) {
  return (
    <ul className="ml-4 list-outside list-disc space-y-2 text-sm text-foreground print:space-y-1">
      {description.map((item) => (
        <li key={item} className="leading-relaxed font-medium print:leading-snug">
          {item}
        </li>
      ))}
    </ul>
  )
}

function ExperienceDetails({ company, period, timing, role, description }: Experience) {
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
      <ExperienceDescription description={description} />
    </div>
  )
}

function ExperienceCard({ company, period, timing, role, description }: Experience) {
  return (
    <Card
      height="2xl"
      className="variant-secondary variant-border max-w-96 shrink-0 bg-[var(--variant-soft)]"
    >
      <CardHeader className="variant-surface-header border-b-2 pb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="variant-soft-chip rounded-none border-2 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-foreground">
            {period}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="tertiary" className="w-fit px-2 text-[10px]">
            {role}
          </Badge>
          <span className="text-[10px] font-black uppercase tracking-widest text-current">
            ({timing})
          </span>
        </div>
        <CardTitle className="mt-2 text-lg font-black uppercase leading-tight tracking-tight">
          {company}
        </CardTitle>
      </CardHeader>
      <CardContent scrollable aria-label={company} className="pt-4">
        <ExperienceDescription description={description} />
      </CardContent>
    </Card>
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
      <div className="hidden print:block sm:block">
        <Timeline>
          {experiences.map((experience, index) => (
            <TimelineItem key={experienceKey(experience)} isLast={index === experiences.length - 1}>
              <TimelineContent>
                <ExperienceDetails {...experience} />
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </div>

      <div
        role="region"
        aria-label="Experience cards"
        tabIndex={0}
        className="flex gap-6 overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background print:hidden sm:hidden"
      >
        {experiences.map((experience) => (
          <ExperienceCard key={experienceKey(experience)} {...experience} />
        ))}
      </div>
    </SectionCard>
  )
}
