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
} from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { PublicShell } from "@/features/resume/components/public-shell"

const title = "Tech Stack - Indra Cahya Edytya"
const description =
  "The tools behind this site: its interface, article publishing, database, authentication, testing, and deployment."

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
      "App Router renders the public pages and articles on the server. Shared components, JetBrains Mono, semantic color tokens, Lucide icons, and Base UI/Radix primitives keep the interface consistent.",
  },
  {
    icon: PencilLine,
    title: "Content",
    tools: "Tiptap · Shiki · rehype · React PDF",
    detail:
      "The private editor stores structured articles. Public pages render sanitized HTML and highlighted code on the server. The résumé PDF is generated in the browser when requested.",
  },
  {
    icon: Database,
    title: "Data",
    tools: "PostgreSQL · Drizzle ORM · Neon serverless driver",
    detail:
      "Articles, tags, sessions, and search live in Postgres. Local development can use the Docker Postgres stack with a Neon compatible HTTP proxy; deployment can use Neon. Public pages still work when the database is not configured.",
  },
  {
    icon: LockKeyhole,
    title: "Author access",
    tools: "Better Auth · GitHub OAuth",
    detail:
      "The author dashboard is gated by GitHub sign in and an allowed account ID. Drafts, editing, and media uploads stay in the admin area.",
  },
  {
    icon: Cloud,
    title: "Deployment",
    tools: "Cloudflare Workers · OpenNext · optional R2",
    detail:
      "OpenNext packages the Next.js app for Cloudflare Workers. R2 can store article covers when configured; public metadata and the sitemap use the deployment origin.",
  },
  {
    icon: Radar,
    title: "Measurement & monitoring",
    tools: "PostHog · Sentry (planned)",
    detail:
      "PostHog measures visits and interactions only after analytics consent. Server errors currently use structured logs. Sentry is the next planned addition and is not integrated yet.",
  },
  {
    icon: FlaskConical,
    title: "Quality and experience",
    tools: "Vitest · Playwright · ESLint · Prettier · CSS · SVG",
    detail:
      "Type checks, unit tests, browser checks, and formatting guard changes. The home page sequence diagram uses SVG lines with CSS animation and respects reduced-motion preferences.",
  },
] as const

export default function TechStackPage() {
  return (
    <PublicShell activePage="tech-stack">
      <div className="space-y-8">
        <section className="border-2 border-border bg-[var(--semantic-action-primary)] p-6 text-[var(--semantic-action-primary-text)] sm:p-8 lg:p-10">
          <div className="flex items-start gap-4">
            <Boxes className="mt-1 h-7 w-7 shrink-0" aria-hidden />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em]">Behind this site</p>
              <h1 className="mt-2 text-3xl font-black uppercase tracking-tight sm:text-4xl">
                Tech Stack
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed sm:text-base">
                The tools used to build, publish, test, and deploy this site, and the job each one
                does.
              </p>
            </div>
          </div>
        </section>

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
            href="/blog"
            className="inline-flex items-center gap-2 border-2 border-border px-4 py-3 text-xs font-black uppercase tracking-[0.14em] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Read articles <ArrowUpRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </PublicShell>
  )
}
