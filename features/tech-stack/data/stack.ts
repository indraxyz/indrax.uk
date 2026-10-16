import {
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
  type LucideIcon,
} from "lucide-react"

interface StackGroup {
  icon: LucideIcon
  title: string
  tools: string
  detail: string
  reason: string
}

export const stackPageContent = {
  title: "Tech Stack",
  subtitle: "How this site is built, how publishing works, and why these tools were chosen.",
  metaTitle: "Tech Stack - Indra Cahya Edytya",
  metaDescription:
    "The tools and services behind this site's interface, publishing, data, security, and deployment.",
  reasonLabel: "Why these tools?",
  overview: {
    title: "Architecture overview",
    description:
      "This site has two interfaces: public pages for readers and a private dashboard for publishing. Both run on Cloudflare Workers, use the same backend APIs, and share a PostgreSQL database. Uploaded images live in Cloudflare R2.",
    flows: [
      {
        title: "Reading",
        description:
          "Profile pages and published articles arrive as HTML. Writing lists load in the browser, with search and filters saved in the URL so readers can share or revisit their results.",
      },
      {
        title: "Publishing",
        description:
          "The author signs in with GitHub, edits content in Tiptap, and saves it through authenticated APIs. Draft previews use signed, expiring links. Publishing makes a post public; unpublishing returns it to draft, while archiving retains it privately.",
      },
      {
        title: "Delivery",
        description:
          "GitHub Actions checks each change. Develop deploys to Preview; a reviewed release pull request promotes it to main, which deploys to Production when deployment is enabled.",
      },
    ],
  },
  sources: {
    title: "Sources",
    description:
      "Explore the implementation and the workflow that builds, tests, and deploys it. The linked guides explain the framework, data fetching, hosting, image storage, and monitoring tools used here.",
  },
} as const

export const stackGroups = [
  {
    icon: Layers3,
    title: "Interface",
    tools: "React Router 8.4 · React 19 · TypeScript · Tailwind CSS 4",
    detail:
      "The home, resume, and Stack pages arrive as server-rendered HTML, as do published articles. Writing lists load in the browser. The admin is a separate React app that shares the public site’s styles and accessible UI components.",
    reason:
      "Server rendering makes profile and article content available before JavaScript loads. Shared components keep reading and publishing consistent, while TypeScript helps catch mistakes during development.",
  },
  {
    icon: Route,
    title: "Data fetching & navigation",
    tools: "TanStack Query · Ky · react-top-loading-bar",
    detail:
      "TanStack Query keeps API results fresh for one minute and refreshes affected data after a save. Ky handles API requests. A top progress bar shows navigation in progress; loading, empty, and error states explain what is happening.",
    reason:
      "Search and filters stay in the URL so links, pagination, and browser Back preserve your choices. Cached results reduce repeat requests. Requests are not automatically retried; failed reads offer a retry control. The admin also rechecks the session on focus or reconnect, and every private API request verifies author access.",
  },
  {
    icon: PencilLine,
    title: "Content",
    tools: "Tiptap · Shiki · rehype · React PDF · cf-workers-og",
    detail:
      "The author writes in Tiptap. Published articles are sanitized and rendered on the server, with Shiki highlighting code blocks. React PDF builds the resume only when Download is selected; cf-workers-og creates images for shared links.",
    reason:
      "The editor stays out of the reader’s article bundle. Loading the PDF tools on demand keeps them off the initial page load.",
  },
  {
    icon: Database,
    title: "Data",
    tools: "PostgreSQL · Drizzle ORM · Neon HTTP · Cloudflare KV / D1 / R2",
    detail:
      "PostgreSQL stores posts, tags, series, and sign-in sessions. Drizzle defines typed queries and migrations; the Neon HTTP driver connects the Worker to the database. Cloudflare KV caches public content, D1 tracks cache revisions and analytics quotas, and R2 stores uploaded images. Draft previews and private API responses are not cached.",
    reason:
      "Posts, tags, and series benefit from relational storage and PostgreSQL full-text search. Public caching reduces database work. Images upload on Save with file-type and size checks; replacing a cover or deleting its post queues cleanup, while images still referenced by other posts are retained.",
  },
  {
    icon: LockKeyhole,
    title: "Author access",
    tools: "Better Auth · GitHub OAuth",
    detail:
      "Better Auth handles GitHub sign-in and database-backed sessions. Only the allowed GitHub account can use private APIs to edit posts, preview drafts, or upload images. Edge rate limits protect API traffic before database work; security headers restrict scripts and image sources.",
    reason:
      "GitHub sign-in avoids a separate password system. The server checks the account’s numeric GitHub ID on every private request, and sessions can be revoked. Sessions have a seven-day rolling expiry and a thirty-day absolute limit. The develop site remains public but is marked non-indexable.",
  },
  {
    icon: Terminal,
    title: "Local development",
    tools: "Node.js · npm · Docker Compose · PostgreSQL · Neon HTTP proxy",
    detail:
      "npm run dev starts the public React Router / Vite server and an independent admin build watcher. Both apps and database tools share .env.local. Docker Compose supplies local PostgreSQL and a Neon-compatible HTTP proxy; local uploads use an isolated R2 bucket served at /local-media.",
    reason:
      "The local proxy exercises the same database driver used by the deployed Worker. Migrations and seed data prepare repeatable tests, including optional sample articles for checking pagination.",
  },
  {
    icon: FlaskConical,
    title: "Quality",
    tools: "TypeScript · Vitest · Playwright · axe · ESLint · Prettier",
    detail:
      "Prettier and ESLint check formatting and code quality; TypeScript checks types. Vitest covers application behavior and PostgreSQL integration. Playwright tests browser journeys against the built Worker, including accessibility checks with axe and a separate development hydration check.",
    reason:
      "Different checks catch different failures: unit tests cover focused behavior, database tests check queries and transactions, and browser tests verify what readers and the author can actually do.",
  },
  {
    icon: GitBranch,
    title: "CI/CD",
    tools: "GitHub Actions · Vite · Wrangler",
    detail:
      "GitHub Actions runs two checks for pull requests and pushes to develop or main. The check job validates formatting, lint, types, unit tests, and both environment builds. The e2e job runs database and browser tests with a seeded local database, plus uploads against isolated R2 storage. When deployment is enabled and both jobs pass, develop deploys to Preview and main deploys to Production.",
    reason:
      "A release moves from develop to main through a pull request. The documented main-branch policy requires reviewer approval, current check and e2e results, a successful Preview deployment, and resolved review conversations. New commits require renewed approval. The repository deployment switch and environment policies control whether a passing push is deployed.",
  },
  {
    icon: Cloud,
    title: "Deployment",
    tools: "Cloudflare Workers · React Router",
    detail:
      "Vite builds the public server-rendered app and static admin assets into one Cloudflare Worker deployment. Wrangler defines the domains and service bindings. Production and develop use separate KV, D1, and R2 resources; only explicitly allowed public settings reach browser bundles.",
    reason:
      "CI checks the generated deployment target and prepares the matching D1 analytics quota tables before release. Production uses indrax.uk and www.indrax.uk; develop uses dev.indrax.uk. A post-deploy security smoke check verifies public access and private boundaries. Alternate workers.dev and preview URLs are disabled.",
  },
  {
    icon: Radar,
    title: "Measurement & monitoring",
    tools: "PostHog · Workers logs · structured server logs",
    detail:
      "After consent, PostHog measures site use through a same-origin Worker gateway with shared monthly quotas in D1. Withdrawing consent stops capture and clears stored identifiers. Structured server errors and Cloudflare Workers logs help investigate failures.",
    reason:
      "The gateway validates analytics traffic and redacts sensitive URLs before forwarding. Worker logs redact query strings, and automatic fetch traces are disabled to avoid recording credentials in upstream paths. Production and Preview have separate analytics budgets.",
  },
] as const satisfies readonly StackGroup[]

export const stackResources = [
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
