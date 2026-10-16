import { ArrowUpRight, Boxes, ChevronDown } from "lucide-react"
import { pageMeta } from "@/app/routes/meta"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { SectionHeader } from "@/components/ui/section-header"
import { controlClassNames } from "@/components/ui/variants"
import { PublicShell } from "@/components/layout/public-shell"
import { stackGroups, stackPageContent, stackResources } from "@/features/tech-stack/data/stack"

export const meta = () =>
  pageMeta(stackPageContent.metaTitle, stackPageContent.metaDescription, "/tech-stack")

export default function TechStackPage() {
  return (
    <PublicShell activePage="tech-stack">
      <div className="space-y-8">
        <div className="variant-primary variant-surface-header border-b-2 border-border p-6">
          <SectionHeader
            icon={<Boxes className="h-5 w-5" aria-hidden />}
            title={stackPageContent.title}
            subtitle={stackPageContent.subtitle}
            headingLevel={1}
            size="lg"
          />
        </div>

        <section
          aria-labelledby="stack-architecture"
          className="border-2 border-border bg-card p-6 shadow-soft"
        >
          <h2 id="stack-architecture" className="text-lg font-black uppercase">
            {stackPageContent.overview.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {stackPageContent.overview.description}
          </p>
          <dl className="mt-5 grid gap-5 md:grid-cols-3">
            {stackPageContent.overview.flows.map(({ title, description }) => (
              <div key={title}>
                <dt className="text-xs font-black uppercase tracking-wide">{title}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="grid gap-6 md:grid-cols-2" data-slot="stack-cards">
          {stackGroups.map(({ icon: Icon, title: groupTitle, tools, detail, reason }) => (
            <section
              key={groupTitle}
              aria-labelledby={`stack-${groupTitle.toLowerCase().replaceAll(" ", "-")}`}
              className="border-2 border-border bg-card p-6 shadow-soft"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-border bg-[var(--semantic-action-tertiary)] text-[var(--semantic-action-tertiary-text)]">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h2
                  id={`stack-${groupTitle.toLowerCase().replaceAll(" ", "-")}`}
                  className="text-lg font-black uppercase"
                >
                  {groupTitle}
                </h2>
              </div>
              <p className="mt-5 text-xs font-black uppercase leading-relaxed tracking-wide text-[var(--semantic-action-secondary)]">
                {tools}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{detail}</p>
              <Collapsible className="mt-4 border-t-2 border-border pt-2">
                <CollapsibleTrigger
                  aria-label={`Why ${groupTitle}`}
                  className="group flex min-h-11 items-center gap-2 text-xs font-black uppercase tracking-[0.14em] transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {stackPageContent.reasonLabel}
                  <ChevronDown
                    className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[panel-open]:rotate-180 motion-reduce:transition-none"
                    aria-hidden
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <p className="pb-2 pt-1 text-sm leading-relaxed text-muted-foreground">
                    {reason}
                  </p>
                </CollapsibleContent>
              </Collapsible>
            </section>
          ))}
        </div>

        <section
          aria-labelledby="stack-source"
          className="border-2 border-border bg-card p-6 shadow-soft"
        >
          <h2 id="stack-source" className="text-lg font-black uppercase">
            {stackPageContent.sources.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {stackPageContent.sources.description}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {stackResources.map(({ label, href }) => (
              <a key={href} href={href} className={`${controlClassNames} min-h-11 px-4 py-3`}>
                {label} <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
              </a>
            ))}
          </div>
        </section>
      </div>
    </PublicShell>
  )
}
