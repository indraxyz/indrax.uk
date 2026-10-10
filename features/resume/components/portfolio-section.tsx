import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SOCIAL_LINKS } from "@/config/site"
import { SECTION_COPY } from "@/features/resume/config"
import { SectionCard } from "@/components/ui/section-card"
import { portfolioItems } from "@/features/resume/data/resume"
import { RAIL_CARD_WIDTH } from "@/features/resume/components/rail-card-width"
import { GithubIcon } from "@/components/ui/github-icon"
import { controlClassNames } from "@/components/ui/variants"
import { cn } from "@/lib/utils"
import { Code } from "lucide-react"

export function PortfolioSection() {
  return (
    <SectionCard
      variant="ghost"
      icon={<Code className="h-5 w-5" />}
      title="Portfolio"
      subtitle={SECTION_COPY.portfolio}
      link={{ href: SOCIAL_LINKS.github, textLink: "Github" }}
      carousel
    >
      {portfolioItems.map((item) => (
        <Card
          key={`${item.title}-${item.year}`}
          height="2xl"
          className={`variant-secondary variant-border ${RAIL_CARD_WIDTH} bg-[var(--variant-soft)]`}
        >
          <CardHeader className="variant-surface-header border-b-2 pb-4">
            <div className="relative flex items-center justify-between gap-4 pe-14">
              <CardTitle className="text-base font-black uppercase tracking-tight">
                {item.title}
              </CardTitle>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${item.title} repository on GitHub (opens in a new tab)`}
                className={cn(
                  controlClassNames,
                  "absolute end-0 top-1/2 min-h-11 min-w-11 -translate-y-1/2 justify-center border-0 hover:text-foreground"
                )}
              >
                <GithubIcon className="h-4 w-4" />
              </a>
            </div>
          </CardHeader>
          <CardContent scrollable aria-label={item.title} className="pt-4">
            <p className="text-sm font-medium leading-relaxed text-foreground print:leading-snug">
              {item.description}
            </p>
            <div className="mt-4 text-sm leading-relaxed">
              <h4 className="font-bold">Features</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {item.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>
            <div className="mt-4 text-sm leading-relaxed">
              <h4 className="font-bold">Tech stack</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {item.techStack.map((tool) => (
                  <li key={tool}>{tool}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      ))}
    </SectionCard>
  )
}
