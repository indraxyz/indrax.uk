# Indra Cahya Edytya — portfolio and writing

Personal home page, resume, writing archive, and single-author admin built with
React Router **8.4.0**, React, TypeScript, and Tailwind CSS v4 on Cloudflare Workers.
The public site uses Framework Mode; the admin is an independent CSR application.

## Rendering and data

| Area                                 | Rendering                                             | Data                                                          |
| ------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------- |
| Home, resume, tech stack             | SSR for SEO and initial content                       | Static feature data; recent writing cards load in the browser |
| Writing archive and series           | Public page shell; cards/results use CSR              | Writing API with TanStack Query                               |
| Published writing detail             | SSR with metadata, Article JSON-LD and sanitized HTML | Public-only database reads and revision cache                 |
| Admin dashboard, list, editor, login | Independent static CSR bundle; no React SSR           | Authenticated backend APIs                                    |
| Shared draft preview                 | CSR page with signed preview API                      | Uncached sanitized article DTO after signature verification   |
| RSS, sitemap, robots, social images  | Resource endpoints                                    | Public-only reads and server image rendering                  |

TanStack Query owns client loading/error/cache state and mutation invalidation.
Ky is the same-origin HTTP transport; requests use native Fetch underneath.
Browser validation provides feedback; API/data-layer validation and authorization
remain mandatory. Moving an editor into the browser does not make a save CPU-free.

## Stack and features

- React Router Framework Mode with Vite and the Cloudflare Vite plugin; separate
  Vite admin bundle and React Router browser routing.
- TanStack Query and Ky for writing cards, archive results, and admin data.
- Neon Postgres over HTTP and Drizzle ORM; batched post/tag writes.
- Better Auth with GitHub OAuth, immutable numeric-ID allowlist, database sessions,
  idle/absolute expiry and private API guards.
- Tiptap authoring; published articles rendered through the existing sanitized
  content pipeline with lazy Shiki highlighting.
- Existing Cloudflare KV/D1 resources cache public data and article revisions;
  private admin and preview responses always use `Cache-Control: no-store`.
- Optional R2 cover uploads and consent-gated PostHog analytics.
- Shared accessible components, theme controls, print-friendly resume, lazy
  browser PDF download, contents navigation and code-copy controls.

Legacy `/blog/*`, `/blog/tag/*`, and `/rss.xml` links redirect to the corresponding
writing URLs. Search, tags, sort, publication dates and read durations share the
`/writing` archive; the right-hand filter sheet applies changes together.
The standalone `/writing/search` and `/writing/tags/:tag` routes are removed;
use query-based archive URLs. `/blog/search` and `/blog/tag/:tag` redirect directly
to the unified archive. The admin Posts page shares these controls, adds status filtering,
and defaults to Recently updated; all private filtering and pagination run on
the authenticated backend. Profile/article social cards and structured data remain server-generated.

## Structure

```text
app/                                 React Router root, entry points, route configuration
app/routes/                          Public route modules, SEO loaders and colocated tests
admin/                               Independent CSR entry and admin route composition
admin/components/                    Common admin shell, navigation and authentication buttons
workers/app.ts                       Worker dispatcher: assets, APIs, resources, public SSR
features/writing/api/                Client transport contracts and backend API handler
features/writing/data/*.server.ts    Public reads, guarded admin reads and atomic mutations
features/writing/components/         Writing cards, discovery controls and article UI
features/writing/components/admin/   Editor and post-management domain UI
features/{home,resume}/               Profile data, compositions, PDF and social cards
components/layout/public-shell.tsx   Shared public layout
components/ui/                       Shared UI primitives and variants
config/site.ts                       Global SITE_URL, SITE_HOST, absoluteUrl and SOCIAL_LINKS
lib/runtime.server.ts                AsyncLocalStorage request/environment context
lib/cache.server.ts                  Public KV cache with D1 revision invalidation
lib/auth-guard.server.ts             Per-request author verification
lib/resources.server.ts              Uploads, feed, metadata and image resource dispatch
lib/db/index.server.ts               Server-only database client
lib/db/                              Drizzle schema, fixtures and local environment
config/                              Build metadata, dev middleware and environment configuration
scripts/                             Build assembly, preview runner and colocated tooling tests
scripts/preview-env.test.ts          Preview environment verification beside its implementation
test/integration/                    Real SQL/transaction/request-budget coverage
e2e/                                 Playwright browser and HTTP coverage
```

See [architecture](ARCHITECTURE.md), [migration decisions](docs/react-router-migration.md),
[testing](docs/testing.md), and [Worker CPU/cache guidance](docs/worker-cpu-optimization.md).

## Local development

Use Node **22.22 or newer**; CI uses Node 24. npm is the package manager.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

The development command serves public SSR through Vite and watches an independent
admin browser build in `public/admin/` (generated and ignored). Production-equivalent preview
builds both public SSR and the independent admin and runs them in Workerd:

```bash
npm run preview
npm run preview:dev
```

During development, a Vite middleware reads generated admin assets directly from
disk so new chunk filenames remain available after watched rebuilds. Admin HTML
and authentication still pass through the Worker. Production serves the assembled
assets through the normal `ASSETS` binding.

Use `.env.local` as the shared local configuration for Vite, Worker bindings,
database tooling and preview. Copy `.env.example` and fill in the settings you need.
Cloudflare loads this file natively during development; remove legacy `.dev.vars`
files after migrating their values because they take precedence over dotenv files.
The same `.env.local` is used when selecting `CLOUDFLARE_ENV=dev`; additional
environment-specific local configuration is not required. Local preview uses local
KV/D1 and does not provision remote resources. Public environment variables are
compiled by Vite; changing them requires rebuilding both bundles.

Put `DATABASE_URL`,
`BETTER_AUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and
`ALLOWED_GITHUB_ID` in `.env.local`. Keep `DIRECT_DATABASE_URL` there for Drizzle's
direct PostgreSQL connection; the Worker and seed use the HTTP `DATABASE_URL`. If the
login page says “Author access is unavailable,” check that these settings are
present there. Keep the browser host and port, `BETTER_AUTH_URL`, and the GitHub
OAuth callback `<origin>/api/auth/callback/github` consistent; `localhost` and
`127.0.0.1` are different origins.

For local development auth, set `BETTER_AUTH_URL` to the Vite browser origin.
Preview explicitly reads the root `.env.local` even though its Worker configuration
lives in `build/server`. It uses `http://127.0.0.1:<port>` for auth by default,
including custom ports; export `BETTER_AUTH_URL` to override it. Exported runtime
settings also override `.env.local`, so CI and browser tests use their isolated
database/auth fixtures. Overrides are written only to a protected temporary file
outside the build and removed when preview exits. Remote auth uses the deployed
HTTPS origin. The preview runner preserves the loopback request origin so production
routes cannot rewrite local auth/CSRF headers.

The final build step removes the local secret file generated by Cloudflare's Vite
plugin. Preview reads `.env.local` directly, so this copy is not needed in build
artifacts.

The `NEXT_PUBLIC_*` settings form an explicit Vite public-variable allowlist.
Only safe public settings use that prefix; never prefix database URLs, tokens, or
OAuth secrets with it.

| Setting                                                                  | Purpose                                                     |
| ------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                                                   | Canonical origin; defaults to `https://indrax.uk`           |
| `NEXT_PUBLIC_SITE_UPDATED_AT`                                            | Optional `YYYY-MM-DD` override; otherwise Git revision date |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`                    | Optional consent-gated analytics                            |
| `NEXT_PUBLIC_MEDIA_ORIGIN`                                               | HTTPS origin allowed for cover images                       |
| `DATABASE_URL`                                                           | Server-only Neon HTTP connection; absent is supported       |
| `DIRECT_DATABASE_URL`                                                    | Plain Postgres connection for migration tooling             |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`                                  | Server session/preview signing and callback origin          |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ALLOWED_GITHUB_ID`          | GitHub single-author authentication                         |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Optional cover storage                                      |

Without a database, static profile pages remain available and public writing
lists are empty. Without auth configuration, signing in is unavailable and
private operations remain closed. The admin shell alone never grants access.

### Local database and author configuration

```bash
npm run db:up
npm run db:migrate
npm run db:seed
npm run db:studio
```

Compose exposes the Neon-compatible HTTP proxy on `4444` and plain Postgres on
`55432`. Use the example local URLs from `.env.example`; this preserves the same
HTTP driver in local and deployed Workers. The seed is idempotent by fixture slug
and does not erase unrelated posts. Use disposable databases for integration and
browser tests.

Create a GitHub OAuth App with `<origin>/api/auth/callback/github`, configure its
client credentials and your **numeric GitHub ID**, and generate the signing secret
with `openssl rand -base64 32`. Apply migrations before login. Set `BETTER_AUTH_URL`
to the matching origin. Account linking is disabled; allowlist/session checks run
on each private request.

## Checks and testing

```bash
npm run check
TEST_DATABASE_URL='<isolated-loopback-HTTP-URL>' npm run test:integration
npm run test:e2e
npx playwright show-report
```

`check` covers format, lint, Wrangler binding/React Router route type generation, TypeScript and
unit tests. Integration tests require an explicit loopback database and check
actual SQL round trips and rollback. Playwright builds the production application
and serves it through Wrangler/Workerd, with read cases before write cases.
Fixture-dependent tests may skip without local database/auth configuration.
See [the test guide](docs/testing.md) for setup, reports and coverage limits.

For 25 additional local writing samples, run the seed with an explicit local URL:

```bash
DATABASE_URL='postgres://indrax:indrax@127.0.0.1:4444/indrax?sslmode=require' npm run db:seed -- --pagination
```

The optional samples are idempotent and restricted to loopback databases. Browse
`/writing?tag=pagination-demo` or `/writing?q=pagination%20demo` for
10 / 10 / 5 results. The archive also includes the two original published fixtures,
giving 10 / 10 / 7 results. Configure `DATABASE_URL` in `.env.local` to use this
database for the Worker and seed. See [release preparation and optimization proposals](docs/public-site-release.md).

## Delivery

GitHub Actions is the deployment owner. Both quality jobs must pass; deployment
runs only on enabled pushes to `develop`/`main`, using separate GitHub environments
and Cloudflare resources. Keep Workers dashboard Git Builds disconnected to avoid
a second release pipeline.

| Branch    | GitHub environment | Worker       | Domain                       |
| --------- | ------------------ | ------------ | ---------------------------- |
| `develop` | Preview            | `indrax-dev` | `dev.indrax.uk`              |
| `main`    | Production         | `indrax`     | `indrax.uk`, `www.indrax.uk` |

The build emits `build/server/wrangler.json`; deployment uses that generated
configuration so the matching environment and bundled assets stay together.
`CLOUDFLARE_ENV=dev` selects the development build. Deploy commands are release
operations, not validation commands:

```bash
npm run deploy:dev
npm run deploy
```

CI needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in each GitHub environment;
`CLOUDFLARE_DEPLOY_ENABLED=true` enables the deployment job. Its token needs the
existing Worker/route permissions plus KV/D1 write access. Store runtime secrets
separately on each Worker, for example `npx wrangler secret put DATABASE_URL --env dev`.
Configure public analytics/media variables in each GitHub environment as needed.

Logs/traces redact URL query strings to protect OAuth codes and preview tokens.
Inspect CPU time separately from wall time in Observability. No local test or
framework migration guarantees that every request fits Workers Free's CPU budget.

## Customization

Resume data and project evidence live under `features/resume/data/`; verify stack
claims against [portfolio source evidence](docs/portfolio-sources.md). Shared styles
live in `app/globals.css`, UI primitives in `components/ui`, and feature composition
stays beside its data. The revision date comes from Git metadata unless overridden.

Author: [Indra Cahya Edytya](https://github.com/indraxyz).
