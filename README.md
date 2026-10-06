# Indra Cahya Edytya - Resume/CV Website

A personal site with a home page, resume, and writing archive, built with Next.js 16, TypeScript, Tailwind CSS v4, and shared UI components.

## 🚀 Features

- **Modern UI/UX**: Clean, professional design with shadcn/ui components
- **Fully Typed**: Complete TypeScript implementation
- **Responsive**: Mobile-first design that works on all devices
- **Print-Friendly**: Prints the complete resume, sidebar included, for PDF export
- **Focused routes**: `/` introduces the author, process, and recent writing; `/resume` contains the full CV; `/writing` lists articles; `/tech-stack` explains this site's implementation
- **Downloadable CV**: react-pdf draws the resume in the browser on request, lazily loaded
- **Designed Social Card**: 1200x630 Open Graph banner generated from the resume data
- **Structured Data**: `ProfilePage` / `Person` JSON-LD linking the GitHub and LinkedIn profiles
- **Measured, with permission**: optional PostHog analytics for pageviews, CV downloads and contact clicks, behind a consent gate that starts nothing until the visitor says yes
- **Writing**: posts from Postgres, syntax-highlighted on the server, with tag pages, an RSS feed, per-post Open Graph cards and `Article` JSON-LD
- **Search**: Postgres full-text search over titles, summaries and article bodies, weighted so a title match wins — a plain GET form, so it needs no JavaScript
- **Series**: an ordered run of posts with its own page and article-to-article navigation, counting only the parts a reader can open
- **Authoring**: a single-author admin behind GitHub OAuth, with a Tiptap editor that never reaches a reader's browser

- **Draft previews**: a signed, hour-long link that makes one unpublished post readable, and nothing else
- **Reading aids**: an in-page contents list, related articles by tag, and copy buttons on code blocks - none of which cost a reader any JavaScript to read
- **Performance**: Built with Next.js 16 and optimized for speed
- **Accessible**: Landmarked page, keyboard-reachable scroll regions, labelled controls

The former `/blog/*` URLs permanently redirect to `/writing/*`; the old `/blog/tag/*` URLs redirect to `/writing/tags/*`. The former `/rss.xml` feed redirects to `/writing/rss.xml`.

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Database**: Neon Postgres via Drizzle ORM (optional — the site builds and serves without one)
- **Content**: Tiptap documents rendered server-side through rehype, with Shiki highlighting
- **Auth**: Better Auth, GitHub OAuth, database-backed sessions
- **Deployment**: Cloudflare Workers via `@opennextjs/cloudflare`
- **Package Manager**: npm
- **Home interaction**: An SVG sequence diagram uses CSS to animate workflow arrows and respects reduced-motion preferences

The public `/tech-stack` page starts with a reading, publishing, and delivery
architecture overview. Its cards explain each tool choice in application,
development, quality, delivery, and monitoring order, followed by links to the
source repository, CI/CD workflow, and GitHub Actions guide.

## 📁 Project Structure

```
├── app/                       # Next.js app directory
│   ├── layout.tsx            # Root layout and metadata
│   ├── page.tsx              # Server route entry, emits the JSON-LD block
│   ├── resume/               # Full CV page
│   ├── opengraph-image.tsx   # Next convention; serves the social card
│   ├── writing/              # Archive, articles, tags, search, series, previews and feed
│   ├── admin/                # Authoring, behind the auth guard
│   ├── api/auth/             # Better Auth endpoints
│   ├── api/upload/           # Presigned cover uploads
│   ├── api/views/            # View counter, served as a tracking pixel
│   ├── not-found.tsx         # Site-wide 404
│   ├── robots.ts             # Generated /robots.txt
│   ├── sitemap.ts            # Generated /sitemap.xml
│   └── globals.css           # Global styles
├── components/               # Shared UI primitives
│   ├── consent-banner.tsx    # Asks before anything is measured; withdrawal control
│   ├── posthog-analytics.tsx # Starts the tracker once consent allows; renders nothing
│   ├── theme-toggle.tsx     # Light / dark / system switcher
│   └── ui/                  # shadcn/ui components
├── instrumentation.ts        # onRequestError - logs what never reaches a try
├── e2e/                      # Playwright end-to-end specs
├── drizzle/                  # Generated database migrations
├── features/
│   ├── writing/                 # Writing feature - components, queries, content, editor
│   ├── home/                 # Home page composition and recent writing
│   └── resume/
│       ├── components/      # Resume feature components
│       ├── data/            # Resume data
│       ├── pdf/             # PDF document and theme
│       ├── utils/           # Resume-specific helpers
│       ├── config.ts        # Resume config
│       ├── social-card.tsx  # Link-preview banner composition
│       └── types.ts         # Resume types
├── docs/                     # Feature specs and implementation plans
├── .github/                  # Dependabot and the CI gate
└── lib/                      # Utility functions
    ├── analytics.ts         # PostHog init and event capture
    ├── analytics-host.ts    # Shared by the tracker and the CSP, so they cannot drift
    ├── consent.ts           # The stored decision; nothing is tracked without it
    ├── observability.ts     # One JSON line per server error, keyed on Next's digest
    ├── auth.ts              # Better Auth instance, allow-list
    ├── auth-guard.ts        # requireAuthor() - the authorization boundary
    ├── db/                  # Drizzle schema, client and seed
    ├── og/                  # Font loading for server-drawn cards
    ├── validators/          # Zod schemas
    └── utils/
```

## 🏃 Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

1. Clone the repository

```bash
git clone <repository-url>
cd indrax-nextjs-shadcn-vercel
```

2. Install dependencies

```bash
npm install
```

3. Run the development server

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Environment

Every variable is optional; copy `.env.example` to `.env.local` to set them.

| Variable                       | Default                      | Purpose                                                                                                                  |
| :----------------------------- | :--------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_POSTHOG_KEY`      | unset                        | PostHog project key. Unset means analytics never initialises.                                                            |
| `NEXT_PUBLIC_POSTHOG_HOST`     | `https://us.i.posthog.com`   | Ingestion host. Also named in `connect-src`, so the two cannot drift.                                                    |
| `NEXT_PUBLIC_SITE_URL`         | `https://indrax.uk`          | Origin advertised in metadata, the sitemap and the social card.                                                          |
| `DATABASE_URL`                 | unset                        | Neon Postgres, pooled. **Server-only.** Unset means the writing archive is empty and the rest of the site is unaffected. |
| `DIRECT_DATABASE_URL`          | falls back to `DATABASE_URL` | The same database over the plain Postgres protocol, for `drizzle-kit` only.                                              |
| `NEXT_PUBLIC_MEDIA_ORIGIN`     | unset                        | Origin cover images may be loaded from. Unset means no cover renders.                                                    |
| `BETTER_AUTH_SECRET`           | unset                        | Session signing key. **Server-only.**                                                                                    |
| `BETTER_AUTH_URL`              | `NEXT_PUBLIC_SITE_URL`       | Origin OAuth callbacks return to.                                                                                        |
| `GITHUB_CLIENT_ID` / `_SECRET` | unset                        | GitHub OAuth App. **Secret is server-only.**                                                                             |
| `ALLOWED_GITHUB_ID`            | unset                        | The one numeric GitHub user id allowed to sign in.                                                                       |
| `R2_*`                         | unset                        | Cover storage. Absent means uploads answer 501.                                                                          |

### The admin

`/admin` exists only when all five auth variables are set. Without them the auth
endpoints answer 404 and there is nothing to sign in to - an unconfigured
deployment is closed rather than half-open.

`/admin` is the author dashboard: it shows live post counts, the latest draft,
and which optional services are configured. `/admin/posts` holds the complete
post list, including drafts and archived posts. The editor stays at
`/admin/new` and `/admin/edit/[id]`.

Below the `md` breakpoint (768px), the admin header uses a menu button to open a
right-side drawer. It keeps the desktop link order (Admin home, Posts, Resume, Writing),
marks the current page, and places theme and sign-out controls at the bottom.
Selecting a link or switching to a desktop viewport closes the drawer. Sign-out
keeps the same confirmation dialog on both layouts.
The mobile menu uses the Base UI Drawer so nested confirmation dialogs share
focus and interaction management. The public personal-information slide-over
uses the Base UI Sheet (Dialog) component.
Both primitives are installed with `npx shadcn@latest add sheet` and
`npx shadcn@latest add drawer`; `components.json` selects the official `base-nova`
registry. Their page-level styles use the site's existing theme and controls.

Set it up once:

1. Create a GitHub OAuth App with the callback URL
   `https://<your-origin>/api/auth/callback/github`.
2. Put its client id and secret in the environment.
3. Set `ALLOWED_GITHUB_ID` to your numeric GitHub user id - not your username,
   which can be changed and reclaimed:
   `curl -s https://api.github.com/users/<you> | jq .id`
4. `openssl rand -base64 32` for `BETTER_AUTH_SECRET`.
5. Run `npm run db:migrate` so the session tables exist.

Enable 2FA on that GitHub account. It is now the only credential standing between
anyone and the ability to publish here.

Account linking is disabled, so only that one GitHub account can ever reach the
admin - not any account that happens to share an email address with it.

### The writing database

The writing reads from Postgres through `@neondatabase/serverless`, which speaks
Neon's HTTP protocol — the only driver that works on Cloudflare Workers, which
cannot open raw TCP sockets. A stock Postgres does not speak that protocol, so
local development runs one behind a Neon-compatible proxy. The application then
uses a single driver everywhere and only `DATABASE_URL` differs.

```bash
npm run db:up        # Postgres + Neon proxy, via docker compose
npm run db:migrate   # apply drizzle/*.sql
npm run db:seed      # three posts, one of them a draft
npm run db:studio    # browse the data
npm run db:down      # stop the stack
```

Copy `.env.example` to `.env.local` and uncomment the two local connection
strings it documents. Postgres is published on **55432**, not 5432, so the stack
does not collide with a Postgres already running on the machine.

Against Neon, set `DATABASE_URL` to the pooled connection string and run
`npm run db:migrate`. Migrate a Neon branch before production — see §13 of
`docs/writing-spec.md`.

### Testing

See the [complete test suite guide](docs/testing.md) for the unit/E2E inventory,
disposable database and auth setup, skip conditions, targeted commands, PNG/HTML/
trace reports, CI gates, debugging, and current coverage limits.

```bash
npm run check           # formatting, lint, types, and unit tests
npm run test:e2e        # production-build browser suite; fixtures needed for full coverage
npx playwright show-report
```

The suite uses Vitest for module logic and Playwright for HTTP/browser flows.
Playwright runs against `next start`, uses Chromium, and runs the write project
after the read project. Export fixture environment variables into the shell;
a green run with skipped database/auth cases does not verify those flows.

Screenshots are saved on browser-test failure; `E2E_SCREENSHOTS=on` also keeps
passing-test PNGs. Traces are retained on failure, and HTML reports are written
locally. CI uploads failure artifacts for 14 days.

### Privacy and consent

PostHog sets first-party cookies, so for UK and EU visitors PECR wants consent
_before_ they are set rather than an opt-out afterwards. The tracker therefore
does not initialise at all until the visitor agrees - not
initialised-then-opted-out, never started, so nothing is written and nothing is
sent. Declining and ignoring produce the same state.

The decision lives in `localStorage`, not a cookie, which means the site sets no
cookies whatsoever before consent. It can be withdrawn from the **Cookies**
control in the footer of every page, which stops the tracker and clears what it
stored.

### Continuous integration

`.github/workflows/ci.yml` runs `npm run check` and a production build on every
pull request. The build runs with no `DATABASE_URL` on purpose: every read
degrades to an empty result rather than throwing, so the site builds without one,
and asserting that in CI keeps it true.

Playwright runs there too, in a second job: it brings up the same
`docker-compose.yml` stack this repository uses locally, migrates, seeds, and
runs the whole suite against Playwright's own pinned Chromium. The auth and
database values in that job are throwaway literals rather than repository
secrets - nothing in the suite authenticates against anything real, and a real
credential placed where it is not needed is the worse option.

`.github/dependabot.yml` raises weekly npm and Actions updates, minor and patch
grouped into one pull request so majors stay separate and get read.

### A note on `overrides`

`package.json` pins three transitive dependencies through overrides.

`esbuild`: `better-auth` declares
`drizzle-kit` as a **runtime** dependency rather than a peer or dev one, which
drags `@esbuild-kit/esm-loader` and an `esbuild` carrying
[GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) into the
production dependency tree. Nothing in that path ever runs in a request, but it is
in the tree, and `npm audit --omit=dev` is right to say so. The override takes it out of the tree; `npm run db:generate`, `db:migrate`,
`db:seed` and `npm run build` were re-run to confirm nothing depended on the old
version.

`sharp` is an optional dependency of Next used for image optimisation, pinned
past [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c)
(libheif). `js-yaml` reaches the tree through ESLint, pinned to the patched 4.x
rather than the 5.x major, which `@eslint/eslintrc` does not accept.

Both audits report zero. Re-run `npm audit` and `npm audit --omit=dev` after any
dependency change: these pins exist because an advisory was published against a
tree that was clean a few days earlier, and that will happen again.

## 📜 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run type-check` - Run TypeScript type checking
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run clean` - Clean build artifacts
- `npm run check` - Format check, lint, type-check and unit tests in one pass
- `npm run test` - Run the Vitest unit suite
- `npm run test:watch` - The same suite, in watch mode
- `npm run test:e2e` - Run the Playwright suite against a production build
- `npm run test:e2e:ui` - The same suite in Playwright's UI mode
- `npm run db:up` / `db:down` - Start or stop the local Postgres + Neon proxy
- `npm run db:generate` / `db:migrate` / `db:seed` / `db:studio` - Database tooling
- `npm run preview` - Build with `@opennextjs/cloudflare` and run it in workerd
- `npm run deploy` - Build and deploy to Cloudflare Workers
- `npm run cf-typegen` - Regenerate the Cloudflare binding types

## 🎨 Customization

### Update Resume Data

Edit `features/resume/data/resume.ts` to update your personal information, experiences, portfolio, etc.

### Styling

- Global styles: `app/globals.css`
- Theme colors: Update CSS variables in `@theme` block
- Component styles: Use Tailwind classes or modify component files

### Components

- UI components: `components/ui/`
- Resume feature components: `features/resume/components/`

## 📦 Deployment

### Cloudflare Workers

`@opennextjs/cloudflare` adapts the Next build for workerd. `wrangler.jsonc` and
`open-next.config.ts` are inert until one of these is run, so `npm run build`
and `npm run start` behave exactly as they always have.

```bash
npm run preview      # build and run locally in workerd
npm run deploy       # deploy indrax to indrax.uk
npm run preview:dev  # build the dev.indrax.uk variant and run it locally
npm run deploy:dev   # deploy indrax-dev to dev.indrax.uk
```

Production explicitly selects the top-level environment; its empty `--env` is
passed through to Wrangler because the OpenNext adapter omits empty named options.

#### Deployment ownership

GitHub Actions owns releases and runs checks before deployment. Keep the Git
connection disconnected under **Workers & Pages → Worker → Settings → Builds**
for both Workers to prevent a second deployment pipeline.

| Worker       | Branch    | Deploy command       | Custom domains               |
| ------------ | --------- | -------------------- | ---------------------------- |
| `indrax-dev` | `develop` | `npm run deploy:dev` | `dev.indrax.uk`              |
| `indrax`     | `main`    | `npm run deploy`     | `indrax.uk`, `www.indrax.uk` |

The deploy scripts include the OpenNext build and set the matching public site URL.
Cloudflare's CI Worker-name override does **not** select `env.dev`; without an
explicit environment, a staging Worker can take over the production custom domains.
See [Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

After a deployment, verify domain ownership against the table above. Successful
asset upload alone does not verify this. Build settings are remote dashboard
configuration and are not changed by editing this repository.

#### Worker observability

Both Workers inherit the observability settings in `wrangler.jsonc`: persisted
invocation/application logs, automatic traces, and Issues detection. The shared
head sampling rate is `1` (100%); reduce it if telemetry volume grows. Query
strings are redacted from request URLs in logs and traces so OAuth codes/state
are not retained there. This does not redact values explicitly written by
application logging, which must continue to exclude credentials and tokens.

Use each Worker's **Observability** pages to inspect logs, traces, and issues,
or `npx wrangler tail --env dev` for live staging logs (`--env=""` for production).
Configuration changes take effect after the matching Worker is deployed through
the release pipeline. Issues processes new failures rather than historical ones.
See [Workers Issues](https://developers.cloudflare.com/workers/observability/issues/)
and [Workers traces](https://developers.cloudflare.com/workers/observability/traces/).

Secrets are never committed. Set them with `wrangler secret put DATABASE_URL`,
and put local ones in `.dev.vars`, which is gitignored.

For local Worker previews, copy `config/worker-env.dev.example` to
`.dev.vars.dev`, or `config/worker-env.production.example` to `.dev.vars` and
fill in the values you need. These local files are ignored by git. Wrangler
loads the matching file at runtime; Next.js build variables still come from
the build process or `.env.local`. Remote Workers use their own secrets and
the GitHub environment variables described below.

When enabled, pushes to `develop` deploy the `dev` Wrangler environment after
the CI checks pass. This uses the GitHub `Preview` environment and publishes
`indrax-dev` at `dev.indrax.uk`. Pushes to `main` deploy the default Wrangler
environment (`indrax` at `indrax.uk` and `www.indrax.uk`) using GitHub
`Production`. Both site URLs are set at build time and at Worker runtime, so
metadata, sitemap links, and auth callbacks use the right origin. Cloudflare
must own the `indrax.uk` zone; these hostnames cannot have conflicting CNAME
records.

`CLOUDFLARE_ACCOUNT_ID` is already configured in both GitHub environments.
Before enabling deployments, add `CLOUDFLARE_API_TOKEN` as a secret to each
environment (`Preview` and `Production`). Scope each token to the Worker and
zone it needs. Then set
the repository variable `CLOUDFLARE_DEPLOY_ENABLED` to `true`. Until that
variable is set, the deploy job is skipped; once enabled, it fails clearly if
either credential is missing. Set optional build variables
`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, and
`NEXT_PUBLIC_MEDIA_ORIGIN` separately in each GitHub environment. These are
embedded into the Next.js build. Local manual deploys require
`npx wrangler login` or the same Cloudflare credentials in the shell.

Set server-side secrets on each Worker separately, for example
`npx wrangler secret put DATABASE_URL --env dev` for staging and
`npx wrangler secret put DATABASE_URL` for production. Use separate databases
if you need data isolation; Wrangler environments do not share secrets. If a
`NEXT_PUBLIC_` variable is also read by the Worker at runtime, configure it
there as well. For GitHub OAuth, set `BETTER_AUTH_URL` to the matching origin
and register `<origin>/api/auth/callback/github` in its OAuth app.

The `workerd` package needs its install script to run to fetch its binary. If
`npm install` was run with install scripts blocked, approve it once with
`npm install-scripts approve workerd` before `npm run preview`.

### Other platforms

Build the project:

```bash
npm run build
```

The output will be in the `.next` directory.

## 📝 License

Private project - All rights reserved

## 👤 Author

**Indra Cahya Edytya**

- Email: indracahyae@gmail.com
- GitHub: [@indraxyz](https://github.com/indraxyz)

---

Made with ❤️ using Next.js and TypeScript

### Site update date

The public footer, PDF and profile SEO dates use the built Git revision date,
resolved automatically by Next.js configuration. Restart the development server
after switching/committing revisions; published sites pick it up on the next deploy.
For builds without a Git checkout, set `NEXT_PUBLIC_SITE_UPDATED_AT` to the revision
calendar date (`YYYY-MM-DD`) at build time. This is optional for normal Git builds
and is not a Worker runtime secret.
