import {
  ArrowUpRight,
  Boxes,
  ChevronDown,
  Cloud,
  Database,
  FlaskConical,
  GitBranch,
  Layers3,
  LockKeyhole,
  PencilLine,
  Radar,
  Route,
  Terminal,
} from "lucide-react"
import { pageMeta } from "@/app/routes/meta"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { SectionHeader } from "@/components/ui/section-header"
import { controlClassNames } from "@/components/ui/variants"
import { PublicShell } from "@/components/layout/public-shell"

const title = "Tech Stack - Indra Cahya Edytya"
const description =
  "The tools and services behind this site's interface, publishing, data, security, and deployment."

export const meta = () => pageMeta(title, description, "/tech-stack")

const groups = [
  {
    icon: Layers3,
    title: "Interface",
    tools: "React Router 8.4 · React 19 · TypeScript · Tailwind CSS 4",
    detail:
      "React Router Framework Mode renders profile pages and published articles on the server. The unified writing archive and series load their results in the browser; the author dashboard is a separately built client application. Tailwind CSS and shared accessible components keep both interfaces consistent.",
    reason:
      "Server rendering keeps content and metadata together, while TypeScript and shared UI components make changes easier to maintain.",
  },
  {
    icon: Route,
    title: "Data fetching & navigation",
    tools: "TanStack Query · Ky · react-top-loading-bar",
    detail:
      "TanStack Query manages loading, errors, a one-minute freshness window, and cache invalidation after edits. Ky sends same-origin API requests. A shared top progress bar follows route transitions and visible queries that have no data yet; an initial loading spinner and retry controls cover first visits and failed requests.",
    reason:
      "Cached results make return visits quicker. Search, sorting, and applied tag, publication date, and read-duration filters share one archive URL. A right-hand filter sheet keeps changes together, and pagination links preserve them, while progress feedback makes waiting visible. Automatic query retries and speculative link prefetching are disabled to limit repeated requests. Most queries do not refetch on focus; the author session is shared across admin routes for one minute and revalidates on focus or reconnect. Every private API request still checks author access.",
  },
  {
    icon: PencilLine,
    title: "Content",
    tools: "Tiptap · Shiki · rehype · React PDF · cf-workers-og",
    detail:
      "Tiptap powers the article editor; Shiki and rehype render sanitized articles on the server, with syntax highlighting loaded when needed. React PDF and the resume document load only when a reader requests a download. cf-workers-og generates social preview images.",
    reason:
      "A structured editor makes publishing practical; server-side article rendering keeps the editor out of the reader’s JavaScript bundle.",
  },
  {
    icon: Database,
    title: "Data",
    tools: "PostgreSQL · Drizzle ORM · Neon HTTP · Cloudflare KV / D1 / R2",
    detail:
      "PostgreSQL stores articles, tags, series, and sessions. Drizzle and the Neon HTTP driver batch list counts and page results in one database round trip. The CACHE_KV binding caches public data and rendered articles; APP_D1 tracks revisions for invalidation and analytics quotas. Search uses PostgreSQL full-text indexing. Separate production and develop R2 buckets store article media through a Worker binding; local development uses an isolated local bucket. Cover uploads happen only on Save and share a purpose-based policy: a 5 MiB cap, allowed image formats, matching file signatures, and server-generated keys. Private APIs and draft previews are uncached.",
    reason:
      "Relational storage fits posts, tags, and sessions. Typed queries and migrations keep the schema explicit, while HTTP access suits the Worker runtime.",
  },
  {
    icon: LockKeyhole,
    title: "Author access",
    tools: "Better Auth · GitHub OAuth",
    detail:
      "Better Auth handles GitHub OAuth sign-in, sign-out, and database-backed sessions through the Drizzle adapter. A numeric GitHub account allowlist protects the author dashboard, drafts, and media uploads. Sessions expire after seven days without a refresh, with a thirty-day absolute limit enforced by the author guard. Public pages and cover media are reachable in both environments. Admin routes and private APIs enforce the GitHub session and author allowlist; the develop site remains non-indexable. Edge rate limits run before database work, and security headers restrict scripts and image sources.",
    reason:
      "Better Auth integrates authentication with the React Router and PostgreSQL stack. GitHub sign-in reuses an existing identity without storing passwords, while database sessions can be revoked and the account allowlist keeps publishing limited to the author.",
  },
  {
    icon: Terminal,
    title: "Local development",
    tools: "Node.js · npm · Docker Compose · PostgreSQL · Neon HTTP proxy",
    detail:
      "npm run dev starts the React Router / Vite public server and an independent admin build watcher. Local cover uploads use the same Worker validation and R2 binding, with media served at /local-media. Local Worker secrets, public build settings, and database tooling share .env.local. Docker Compose provides PostgreSQL and a Neon-compatible HTTP proxy. Drizzle applies migrations and seeds articles, with 25 optional local samples for checking pagination.",
    reason:
      "A local database and HTTP proxy let development and browser tests exercise the same driver as the deployed application.",
  },
  {
    icon: FlaskConical,
    title: "Quality",
    tools: "TypeScript · Vitest · Playwright · axe · ESLint · Prettier",
    detail:
      "Type checks and unit tests cover focused behavior. Real PostgreSQL integration tests check request budgets and atomic writes; Playwright runs browser journeys against the built Worker, including accessibility checks with axe.",
    reason:
      "Unit tests check focused behavior; browser tests verify complete journeys, and shared checks catch issues before deployment.",
  },
  {
    icon: GitBranch,
    title: "CI/CD",
    tools: "GitHub Actions · Vite · Wrangler",
    detail:
      "Pull requests and pushes to main or develop run two required GitHub Actions jobs: check covers formatting, linting, type checks, unit tests, and both environment builds with target validation; e2e covers database integration and browser tests against a seeded local database, plus uploads against isolated R2 storage. Passing pushes to develop deploy indrax-dev through the Preview environment; main deploys indrax through Production. Deployments require the repository deployment switch and the selected environment’s policies. Superseded quality checks are canceled; deployments finish in sequence for each branch.",
    reason:
      "Releases move from develop to main through a pull request. Main requires one eligible reviewer’s approval, up-to-date check and e2e results, a successful Preview deployment, and resolved review conversations. New commits dismiss stale approvals. These protections also apply to administrators and block force pushes and branch deletion.",
  },
  {
    icon: Cloud,
    title: "Deployment",
    tools: "Cloudflare Workers · React Router",
    detail:
      "Vite builds the public SSR Worker and static admin assets. Wrangler configuration defines runtime variables and bindings; only explicitly allowed public settings reach browser bundles. Before deployment, CI prepares the matching D1 analytics quota tables and verifies the generated Worker name, domains, site and media URLs, and KV/D1/R2 bindings. Develop targets indrax-dev at dev.indrax.uk, while main targets indrax at indrax.uk and www.indrax.uk, with separate KV, D1, and R2 resources. After deployment, a security smoke check verifies public access and private boundaries. workers.dev and preview URLs are disabled so custom-domain protections cannot be bypassed.",
    reason:
      "React Router supports server rendering for SEO and a static browser application for admin, with shared APIs on Workers.",
  },
  {
    icon: Radar,
    title: "Measurement & monitoring",
    tools: "PostHog · Workers logs · structured server logs",
    detail:
      "PostHog starts after consent and sends analytics through a same-origin Worker gateway. The gateway keeps the project credential on the server, validates requests, redacts sensitive URLs, and reserves shared monthly quotas in D1 before forwarding. Production and Preview have separate quota budgets. Withdrawing consent stops capture and clears stored identifiers. Structured errors and Cloudflare Workers logs support diagnosis; request query strings are redacted to protect OAuth codes and preview tokens. Automatic fetch traces are disabled to avoid recording credential-bearing upstream paths. Worker CPU time and request duration measure different costs.",
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
    label: "React Router on Cloudflare Workers",
    href: "https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/",
  },
  { label: "Cloudflare R2 storage", href: "https://developers.cloudflare.com/r2/" },
  {
    label: "TanStack Query",
    href: "https://tanstack.com/query/latest/docs/framework/react/overview",
  },
  { label: "Ky HTTP client", href: "https://github.com/sindresorhus/ky" },
  { label: "Navigation progress bar", href: "https://github.com/klendi/react-top-loading-bar" },
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
            One React Router application serves SEO pages, while a static client application serves
            the author dashboard. Vite packages both for Cloudflare Workers; server-side queries
            access PostgreSQL through the Neon HTTP driver, and R2 storage holds article media
            through a Worker binding. Local media uses an isolated bucket served by the development
            Worker.
          </p>
          <dl className="mt-5 grid gap-5 md:grid-cols-3">
            <div>
              <dt className="text-xs font-black uppercase tracking-wide">Reading</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Resume content comes from typed project data. Published articles come from
                PostgreSQL and are rendered and sanitized on the server. Writing lists load through
                Ky and TanStack Query in the browser, with shared navigation progress feedback.
              </dd>
            </div>
            <div>
              <dt className="text-xs font-black uppercase tracking-wide">Publishing</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The author signs in with GitHub, edits content in Tiptap, and saves it through
                authenticated API endpoints. PostgreSQL stores drafts, published posts, and
                sessions.
              </dd>
            </div>
            <div>
              <dt className="text-xs font-black uppercase tracking-wide">Delivery</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                GitHub Actions checks each change. Develop deploys to Preview; a reviewed release
                pull request promotes it to main, which deploys to Production when deployment is
                enabled.
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
              <Collapsible className="mt-4 border-t-2 border-border pt-2">
                <CollapsibleTrigger
                  aria-label={`Why ${groupTitle}`}
                  className="group flex min-h-11 items-center gap-2 text-xs font-black uppercase tracking-[0.14em] transition-colors hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Why
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
            Sources
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Explore the implementation and the workflow that builds, tests, and deploys it. The
            GitHub Actions guide explains the pipeline; Cloudflare documentation covers the Workers
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
