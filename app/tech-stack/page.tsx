import {
  ArrowUpRight,
  Boxes,
  Cloud,
  Database,
  FlaskConical,
  GitBranch,
  Layers3,
  LockKeyhole,
  PencilLine,
  Radar,
  Terminal,
} from "lucide-react"
import type { Metadata } from "next"

import { SectionHeader } from "@/components/ui/section-header"
import { controlClassNames } from "@/components/ui/variants"
import { PublicShell } from "@/features/resume/components/public-shell"

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
    reason:
      "Server rendering keeps content and metadata together, while TypeScript and shared UI components make changes easier to maintain.",
  },
  {
    icon: PencilLine,
    title: "Content",
    tools: "Tiptap · Shiki · rehype · React PDF",
    detail:
      "Tiptap powers the article editor; Shiki and rehype render formatted, sanitized articles. React PDF generates the downloadable resume.",
    reason:
      "A structured editor makes publishing practical; server-side article rendering keeps the editor out of the reader’s JavaScript bundle.",
  },
  {
    icon: Database,
    title: "Data",
    tools: "PostgreSQL · Drizzle ORM · Neon serverless driver · Cloudflare R2",
    detail:
      "PostgreSQL stores articles, tags, and sessions. Drizzle ORM handles queries and migrations; the Neon serverless driver connects from Cloudflare Workers. R2 stores article media when configured.",
    reason:
      "Relational storage fits posts, tags, and sessions. Typed queries and migrations keep the schema explicit, while HTTP access suits the Worker runtime.",
  },
  {
    icon: LockKeyhole,
    title: "Author access",
    tools: "Better Auth · GitHub OAuth",
    detail:
      "Better Auth handles GitHub OAuth sign-in, sign-out, and database-backed sessions through the Drizzle adapter. A numeric GitHub account allowlist protects the author dashboard, drafts, and media uploads. Sessions expire after seven days without a refresh, with a thirty-day absolute limit enforced by the author guard.",
    reason:
      "Better Auth integrates authentication with the existing Next.js and PostgreSQL stack. GitHub sign-in reuses an existing identity without storing passwords, while database sessions can be revoked and the account allowlist keeps publishing limited to the author.",
  },
  {
    icon: Terminal,
    title: "Local development",
    tools: "Node.js · npm · Docker Compose · PostgreSQL · Neon HTTP proxy",
    detail:
      "Next.js runs locally with npm run dev and .env.local configuration. Docker Compose provides PostgreSQL and a Neon-compatible HTTP proxy, so the app uses the same database driver locally and on Workers. Drizzle applies migrations and seeds sample articles; a Neon connection can also be used for local development.",
    reason:
      "A local database and HTTP proxy let development and browser tests exercise the same driver as the deployed application.",
  },
  {
    icon: FlaskConical,
    title: "Quality",
    tools: "Vitest · Playwright · ESLint · Prettier",
    detail:
      "Type checks, unit tests, and browser tests cover application behavior and accessibility.",
    reason:
      "Unit tests check focused behavior; browser tests verify complete journeys, and shared checks catch issues before deployment.",
  },
  {
    icon: GitBranch,
    title: "CI/CD",
    tools: "GitHub Actions · OpenNext · Wrangler",
    detail:
      "Pull requests and pushes to main or develop run formatting, linting, type checks, unit tests, production builds, and browser tests against a seeded database. When deployment is enabled, passing checks deploy develop to the preview Worker and main to production using separate GitHub environments.",
    reason:
      "Keeping checks and deployment in one versioned workflow makes releases repeatable and requires both check and browser-test jobs to pass before deployment.",
  },
  {
    icon: Cloud,
    title: "Deployment",
    tools: "Cloudflare Workers · OpenNext",
    detail: "OpenNext builds the Next.js app for Cloudflare Workers.",
    reason:
      "OpenNext adapts the existing Next.js application to Workers, so the public site and admin can share one codebase and deployment target.",
  },
  {
    icon: Radar,
    title: "Measurement & monitoring",
    tools: "PostHog · structured server logs",
    detail:
      "PostHog records analytics after consent. Server errors are captured in structured logs.",
    reason:
      "Consent-based analytics helps understand readership, while structured errors make server failures easier to investigate.",
  },
] as const

const resources = [
  { label: "Source on GitHub", href: "https://github.com/indraxyz/indrax.uk" },
  {
    label: "CI/CD workflow",
    href: "https://github.com/indraxyz/indrax.uk/blob/develop/.github/workflows/ci.yml",
  },
  {
    label: "How GitHub Actions works",
    href: "https://docs.github.com/en/actions/get-started/understand-github-actions",
  },
  {
    label: "Next.js on Cloudflare Workers",
    href: "https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/",
  },
  { label: "Cloudflare R2 storage", href: "https://developers.cloudflare.com/r2/" },
  {
    label: "Workers observability",
    href: "https://developers.cloudflare.com/workers/observability/",
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

        <section
          aria-labelledby="stack-architecture"
          className="border-2 border-border bg-card p-6 shadow-soft"
        >
          <h2 id="stack-architecture" className="text-lg font-black uppercase">
            Architecture overview
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            One Next.js application serves the public site and the author dashboard. OpenNext
            packages it for Cloudflare Workers; server-side queries access PostgreSQL through the
            Neon HTTP driver, and optional R2 storage holds article media.
          </p>
          <dl className="mt-5 grid gap-5 md:grid-cols-3">
            <div>
              <dt className="text-xs font-black uppercase tracking-wide">Reading</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Resume content comes from typed project data. Published articles come from
                PostgreSQL and are rendered and sanitized on the server before reaching readers.
              </dd>
            </div>
            <div>
              <dt className="text-xs font-black uppercase tracking-wide">Publishing</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The author signs in with GitHub, edits content in Tiptap, and saves it through
                guarded server actions. PostgreSQL stores drafts, published posts, and sessions.
              </dd>
            </div>
            <div>
              <dt className="text-xs font-black uppercase tracking-wide">Delivery</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                GitHub Actions runs checks and browser tests. When deployment is enabled, successful
                pushes to develop publish the preview Worker; main publishes production.
              </dd>
            </div>
          </dl>
        </section>

        <div className="grid gap-6 md:grid-cols-2" data-slot="stack-cards">
          {groups.map(({ icon: Icon, title: groupTitle, tools, detail, reason }) => (
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
              <p className="mt-4 border-t-2 border-border pt-4 text-sm leading-relaxed text-muted-foreground">
                <span className="font-bold text-foreground">Why: </span>
                {reason}
              </p>
            </section>
          ))}
        </div>

        <section
          aria-labelledby="stack-source"
          className="border-2 border-border bg-card p-6 shadow-soft"
        >
          <h2 id="stack-source" className="text-lg font-black uppercase">
            Source &amp; workflow
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Explore the implementation and the workflow that builds, tests, and deploys it. The
            GitHub Actions guide explains the pipeline; Cloudflare documentation covers the Next.js
            runtime, optional media storage, and operational monitoring.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {resources.map(({ label, href }) => (
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
