# Indra Cahya Edytya - Resume/CV Website

A modern, responsive resume/curriculum vitae website built with Next.js 16, TypeScript, Tailwind CSS v4, and shadcn/ui components.

## 🚀 Features

- **Modern UI/UX**: Clean, professional design with shadcn/ui components
- **Fully Typed**: Complete TypeScript implementation
- **Responsive**: Mobile-first design that works on all devices
- **Print-Friendly**: Prints the complete resume, sidebar included, for PDF export
- **Downloadable CV**: react-pdf draws the resume in the browser on request, lazily loaded
- **Designed Social Card**: 1200x630 Open Graph banner generated from the resume data
- **Structured Data**: `ProfilePage` / `Person` JSON-LD linking the GitHub and LinkedIn profiles
- **Measured**: optional PostHog analytics for pageviews, CV downloads, and contact clicks
- **Blog**: articles from Postgres, syntax-highlighted on the server, with tag pages, an RSS feed, per-article Open Graph cards and `Article` JSON-LD
- **Authoring**: a single-author admin behind GitHub OAuth, with a Tiptap editor that never reaches a reader's browser
- **Performance**: Built with Next.js 16 and optimized for speed
- **Accessible**: Landmarked page, keyboard-reachable scroll regions, labelled controls

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

## 📁 Project Structure

```
├── app/                       # Next.js app directory
│   ├── layout.tsx            # Root layout and metadata
│   ├── page.tsx              # Server route entry, emits the JSON-LD block
│   ├── opengraph-image.tsx   # Next convention; serves the social card
│   ├── blog/                 # List, article, tag pages and per-article cards
│   ├── admin/                # Authoring, behind the auth guard
│   ├── api/auth/             # Better Auth endpoints
│   ├── api/upload/           # Presigned cover uploads
│   ├── rss.xml/              # RSS 2.0 feed
│   ├── not-found.tsx         # Site-wide 404
│   ├── robots.ts             # Generated /robots.txt
│   ├── sitemap.ts            # Generated /sitemap.xml
│   └── globals.css           # Global styles
├── components/               # Shared UI primitives
│   ├── posthog-analytics.tsx # Starts the tracker; renders nothing
│   ├── theme-toggle.tsx     # Light / dark / system switcher
│   └── ui/                  # shadcn/ui components
├── e2e/                      # Playwright end-to-end specs
├── drizzle/                  # Generated database migrations
├── features/
│   ├── blog/                 # Blog slice - components, queries, content, editor
│   └── resume/
│       ├── components/      # Resume feature components
│       ├── data/            # Resume data
│       ├── pdf/             # PDF document and theme
│       ├── utils/           # Resume-specific helpers
│       ├── config.ts        # Resume config
│       ├── social-card.tsx  # Link-preview banner composition
│       └── types.ts         # Resume types
├── docs/                     # Feature specs and implementation plans
└── lib/                      # Utility functions
    ├── analytics.ts         # PostHog init and event capture
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

| Variable                       | Default                      | Purpose                                                                                                       |
| :----------------------------- | :--------------------------- | :------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_POSTHOG_KEY`      | unset                        | PostHog project key. Unset means analytics never initialises.                                                 |
| `NEXT_PUBLIC_POSTHOG_HOST`     | `https://us.i.posthog.com`   | Ingestion host.                                                                                               |
| `NEXT_PUBLIC_SITE_URL`         | `https://indrax.uk`          | Origin advertised in metadata, the sitemap and the social card.                                               |
| `DATABASE_URL`                 | unset                        | Neon Postgres, pooled. **Server-only.** Unset means the blog is empty and the rest of the site is unaffected. |
| `DIRECT_DATABASE_URL`          | falls back to `DATABASE_URL` | The same database over the plain Postgres protocol, for `drizzle-kit` only.                                   |
| `NEXT_PUBLIC_MEDIA_ORIGIN`     | unset                        | Origin cover images may be loaded from. Unset means no cover renders.                                         |
| `BETTER_AUTH_SECRET`           | unset                        | Session signing key. **Server-only.**                                                                         |
| `BETTER_AUTH_URL`              | `NEXT_PUBLIC_SITE_URL`       | Origin OAuth callbacks return to.                                                                             |
| `GITHUB_CLIENT_ID` / `_SECRET` | unset                        | GitHub OAuth App. **Secret is server-only.**                                                                  |
| `ALLOWED_GITHUB_ID`            | unset                        | The one numeric GitHub user id allowed to sign in.                                                            |
| `R2_*`                         | unset                        | Cover storage. Absent means uploads answer 501.                                                               |

### The admin

`/admin` exists only when all five auth variables are set. Without them the auth
endpoints answer 404 and there is nothing to sign in to - an unconfigured
deployment is closed rather than half-open.

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

### The blog database

The blog reads from Postgres through `@neondatabase/serverless`, which speaks
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
`docs/blog-spec.md`.

### Testing

```bash
npx playwright install chromium   # once
npm run test:e2e
```

The suite builds the site and runs against `next start`, because the CV and the
social card are prerendered at build time and behave differently under `next dev`.

`e2e/blog-content.spec.ts` needs content, so it skips itself unless
`DATABASE_URL` is set. To run it, bring the local stack up and seed it first:

```bash
npm run db:up && npm run db:migrate && npm run db:seed
DATABASE_URL='postgres://indrax:indrax@127.0.0.1:4444/indrax?sslmode=require' npm run test:e2e
```

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
- `npm run check` - Format check, lint and type-check in one pass
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
npm run preview   # build and run locally in workerd
npm run deploy    # build and deploy
```

Secrets are never committed. Set them with `wrangler secret put DATABASE_URL`,
and put local ones in `.dev.vars`, which is gitignored.

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
