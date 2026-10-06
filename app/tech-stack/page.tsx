import {
  ArrowUpRight,
  Boxes,
  Cloud,
  Database,
  FlaskConical,
  Layers3,
  LockKeyhole,
  PencilLine,
  Radar,
  Terminal,
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { SectionHeader } from "@/components/ui/section-header"
import { PublicShell } from "@/features/resume/components/public-shell"
import { WRITING_CONFIG } from "@/features/writing/config"

const title = "Tech Stack - Indra Cahya Edytya"
const description =
  "The tools and services behind this site's interface, publishing, data, security, and deployment."

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/tech-stack" },
  openGraph: { type: "website", url: "/tech-stack", title, description },
}

const groups = [
  {
    icon: Layers3,
    title: "Interface",
    tools: "Next.js 16 · React 19 · TypeScript · Tailwind CSS 4",
    detail:
      "Next.js App Router and React Server Components render pages on the server. Tailwind CSS, shared components, and accessible UI primitives keep the interface consistent.",
  },
  {
    icon: PencilLine,
    title: "Content",
    tools: "Tiptap · Shiki · rehype · React PDF",
    detail:
      "Tiptap powers the article editor; Shiki and rehype render formatted, sanitized articles. React PDF generates the downloadable resume.",
  },
  {
    icon: Database,
    title: "Data",
    tools: "PostgreSQL · Drizzle ORM · Neon serverless driver · Cloudflare R2",
    detail:
      "PostgreSQL stores articles, tags, and sessions. Drizzle ORM handles queries and migrations; the Neon serverless driver connects from Cloudflare Workers. R2 stores article media when configured.",
  },
  {
    icon: LockKeyhole,
    title: "Author access",
    tools: "Better Auth · GitHub OAuth",
    detail:
      "GitHub OAuth and a numeric account allowlist protect the author dashboard, drafts, and media uploads.",
  },
  {
    icon: Cloud,
    title: "Deployment",
    tools: "Cloudflare Workers · OpenNext",
    detail: "OpenNext builds the Next.js app for Cloudflare Workers.",
  },
  {
    icon: Radar,
    title: "Measurement & monitoring",
    tools: "PostHog · structured server logs",
    detail:
      "PostHog records analytics after consent. Server errors are captured in structured logs.",
  },
  {
    icon: Terminal,
    title: "Local development",
    tools: "Node.js · npm · Docker Compose · PostgreSQL · Neon HTTP proxy",
    detail:
      "Next.js runs locally with npm run dev and .env.local configuration. Docker Compose provides PostgreSQL and a Neon-compatible HTTP proxy, so the app uses the same database driver locally and on Workers. Drizzle applies migrations and seeds sample articles; a Neon connection can also be used for local development.",
  },
  {
    icon: FlaskConical,
    title: "Quality",
    tools: "Vitest · Playwright · ESLint · Prettier",
    detail:
      "Type checks, unit tests, and browser tests cover application behavior and accessibility.",
  },
] as const

export default function TechStackPage() {
  return (
    <PublicShell activePage="tech-stack">
      <div className="space-y-8">
        <div className="variant-primary variant-surface-header border-b-2 border-border p-6">
          <SectionHeader
            icon={<Boxes className="h-5 w-5" aria-hidden />}
            title="Tech Stack"
            subtitle="Tools and services used to build and run this site."
            headingLevel={1}
            size="lg"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {groups.map(({ icon: Icon, title: groupTitle, tools, detail }) => (
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
            </section>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 print:hidden">
          <Link
            href="/resume"
            className="inline-flex items-center gap-2 border-2 border-border px-4 py-3 text-xs font-black uppercase tracking-[0.14em] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            See my experience <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href={WRITING_CONFIG.basePath}
            className="inline-flex items-center gap-2 border-2 border-border px-4 py-3 text-xs font-black uppercase tracking-[0.14em] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Read writing <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </PublicShell>
  )
}
