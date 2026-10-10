import { Badge } from "@/components/ui/badge"
import { SectionCard } from "@/components/ui/section-card"
import { Timeline, TimelineContent, TimelineItem } from "@/components/ui/timeline"
import { SOCIAL_LINKS } from "@/config/site"
import { SECTION_COPY } from "@/features/resume/config"
import { experiences } from "@/features/resume/data/resume"
import { Briefcase } from "lucide-react"

type Experience = (typeof experiences)[number]

const experienceKey = (experience: Experience) => `${experience.company}-${experience.period}`

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

export function ExperienceSection() {
  return (
    <SectionCard
      variant="ghost"
      icon={<Briefcase className="h-5 w-5" />}
      title="Experiences"
      subtitle={SECTION_COPY.experiences}
      link={{ href: SOCIAL_LINKS.linkedin, textLink: "Linkedin" }}
      height="2xl"
      className="min-h-0 max-h-svh sm:max-h-none"
      contentClassName="pt-8 pb-4 pr-2 sm:pr-4 sm:overflow-visible"
    >
      <Timeline role="list" aria-label="Experience timeline">
        {experiences.map((experience, index) => (
          <TimelineItem
            role="listitem"
            key={experienceKey(experience)}
            isLast={index === experiences.length - 1}
          >
            <TimelineContent>
              <ExperienceDetails {...experience} />
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </SectionCard>
  )
}
