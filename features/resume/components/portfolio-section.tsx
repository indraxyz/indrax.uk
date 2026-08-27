import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SOCIAL_LINKS } from "@/features/resume/config"
import { SectionCard } from "@/components/ui/section-card"
import { portfolioItems } from "@/features/resume/data/resume"
import { Code, ExternalLink } from "lucide-react"
import Link from "next/link"

export function PortfolioSection() {
  return (
    <SectionCard
      variant="ghost"
      icon={<Code className="h-5 w-5" />}
      title="Portfolio"
      subtitle="Selected projects that show practical delivery across web, mobile, and integrated product systems."
      link={{ href: SOCIAL_LINKS.github, textLink: "Github" }}
      contentClassName="flex gap-6 overflow-x-auto"
    >
      {portfolioItems.map((item) => (
        <Card
          key={`${item.title}-${item.year}`}
          height="md"
          className="variant-secondary variant-border w-[350px] max-w-[85vw] shrink-0 bg-[var(--variant-soft)]"
        >
          <CardHeader className="variant-surface-header border-b-2 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1.5">
                <CardTitle className="text-base font-black uppercase leading-snug tracking-tight">
                  {item.title}
                </CardTitle>
                <p className="variant-soft-chip w-fit rounded-none border-2 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-foreground">
                  {item.year}
                </p>
              </div>
              {item.link && (
                <Link
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  <ExternalLink className="h-4 w-4 text-foreground transition-colors hover:text-[var(--component-variant-secondary-bg)]" />
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent scrollable className="pt-4">
            <p className="text-sm font-medium leading-relaxed text-foreground">
              {item.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </SectionCard>
  )
}
