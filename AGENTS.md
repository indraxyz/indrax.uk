# AGENTS.md

Guidance for coding agents (Claude Code, Codex, Cursor and others) working in this
repository. `CLAUDE.md` imports this file; keep shared instructions here.

## What this is

Personal portfolio, resume, writing archive and single-author admin for indrax.uk.
React Router 8.4 Framework Mode (public SSR) plus an independent CSR admin bundle,
both served by one Cloudflare Worker. Neon Postgres over HTTP with Drizzle, Better
Auth (GitHub OAuth, numeric-ID allowlist), Tiptap authoring, TanStack Query + Ky,
Tailwind CSS v4, KV/D1 public cache, optional R2 covers, consent-gated PostHog.

Longer references: `README.md`, `ARCHITECTURE.md`, `docs/testing.md`,
`docs/project-structure-and-environment.md`, `docs/development-and-deployment.md`,
`docs/d1-kv-cache.md`, `docs/database-structure.md`.

## Commands

Node 22.22+ (CI uses 24), npm only.

```bash
npm run dev            # public SSR via Vite + watched admin build into public/admin/
npm run check          # prettier --check, eslint, cf-typegen + route typegen + tsc, vitest
npm run build          # SSR Worker + admin bundle, assembled into build/
npm run preview        # build, then run in Workerd (local KV/D1); preview:dev uses CLOUDFLARE_ENV=dev
npm run format         # prettier --write
npm run lint:fix
```

Single tests:

```bash
npx vitest run lib/cache.server.test.ts          # one unit file
npx vitest run -t "name of case"                 # by test name
npm run test:e2e -- e2e/writing-content.spec.ts  # one Playwright spec (builds, serves on 3210)
npm run test:e2e -- --project=reads              # or --project=writes, --workers=1 to debug writes
```

Database (Docker Compose: Neon HTTP proxy on 4444, Postgres on 55432):

```bash
npm run db:up && npm run db:migrate && npm run db:seed
npm run db:generate    # new Drizzle migration in drizzle/ after editing lib/db/schema.ts
TEST_DATABASE_URL='postgres://indrax:indrax@127.0.0.1:4444/indrax?sslmode=require' npm run test:integration
```

Integration tests refuse any non-loopback `TEST_DATABASE_URL` and never fall back to
`.env.local`. Full disposable-database and fixture setup is in `docs/testing.md`.

`npm run deploy` and `npm run deploy:dev` push to live Cloudflare Workers. They are
release operations, not validation; never run them unless explicitly asked.

## Architecture

**Request dispatch.** `workers/app.ts` is the single entry. It routes early and
dynamically imports the matching handler: static/admin assets (admin navigation
serves `admin/index.html` and never loads the public SSR tree), writing/admin APIs
(`features/writing/api/server.ts`), resources such as feeds, sitemap, OG images,
uploads and auth (`lib/resources.server.ts`), and finally React Router SSR.
Security headers are centralized in the Worker.

**Two frontends, one backend.** Public routes are declared in `app/routes.ts`;
modules in `app/routes/` compose feature components and export loaders/meta.
Profile pages and `/writing/:slug` are SSR; the `/writing` archive, series cards,
home "recent writing" and draft preview fetch via API in the browser. The admin
(`admin/`) is a separate Vite build (`vite.admin.config.ts`) with explicit browser
routes in `admin/routes.tsx`; `admin/layouts/protected-admin.tsx` owns the session
lifecycle. Both use TanStack Query (`components/query-provider.tsx`) over Ky, with
typed DTO functions in `features/writing/api/client.ts`.

**Server/browser boundary.** Anything touching database, auth, storage credentials
or preview signing lives in `*.server.ts` and must not be imported from browser
code. Runtime bindings and secrets come from AsyncLocalStorage in
`lib/runtime.server.ts`. Vite embeds only an explicit allowlist of public variables
(`config/public-env.ts`); changing one requires rebuilding both bundles.

**Data and auth.** SQL lives only in `features/writing/data/*.server.ts`. Public
reads always enforce published status, publish date and content presence; there
is no flag to include drafts. Admin reads are separate and never cached. Every
private API re-verifies the session and numeric GitHub allowlist
(`lib/auth-guard.server.ts`); a session cookie is only a navigation hint. Mutations
require same Origin and JSON, bodies are streamed with a 512 KiB cap, and
post/tag writes use Drizzle Neon batch for atomicity. Schema changes go through
Drizzle migrations in `drizzle/`.

**Caching.** `lib/cache.server.ts` memoizes per request, then uses KV with D1
revision keys for invalidation. Mutations await invalidation. Rendered articles are
keyed by post ID, slug, revision and renderer version: bump the renderer version
when sanitizing/rendering policy changes. Private, admin and preview responses are
always `Cache-Control: no-store`.

**Uploads.** One verified pipeline in `lib/upload.server.ts` driven by per-purpose
policies in `lib/uploads/`.

## Where code goes

- Domain logic and UI: `features/<feature>/` (writing editor/post management in
  `features/writing/components/admin/`). Resume and stack content are typed TS
  objects in `features/resume/data/` and `features/tech-stack/data/`.
- Shared UI primitives: `components/ui/`; public layout: `components/layout/`;
  common admin chrome: `admin/components/`.
- Shared infrastructure: `lib/`; site origin and social links: `config/site.ts`.
- Unit tests sit beside the code as `*.test.ts`; SQL integration tests in
  `test/integration/`; Playwright specs in `e2e/` as `*.spec.ts`. Shared e2e
  fixture names live in `e2e/support/constants.ts`.
- Import alias `@/` maps to the repo root.

## Conventions

- Prettier: no semicolons, double quotes, 100-column width, ES5 trailing commas.
  Markdown is formatted too, so `npm run check` fails on unformatted docs.
- Reuse existing feature modules, React Router mechanisms and API contracts; do not
  add a second frontend or API pipeline.
- Keep docs and tests beside the behavior they describe; update the relevant
  `docs/*.md` when changing documented behavior.
- Playwright `reads` run in parallel; `writes` (`admin-authoring`, `admin-session`)
  run after them serially. Fixture-dependent specs skip without database/auth env;
  report skips and retries rather than calling a subset a clean pass.
- Stop `npm run dev` before `npm run test:e2e:uploads`; both write `public/admin/`.
- Do not read or edit `.env.local` or other `.env.*` files; `.env.example`
  documents the settings.

## Workflow

Branch from `develop`, PR into `develop` (deploys Preview to `dev.indrax.uk`).
Production ships only via a `develop` to `main` release PR. CI (`.github/workflows/ci.yml`)
runs `check` and `e2e` jobs and owns all deployments.
