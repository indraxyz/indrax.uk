# Architecture Overview

This document describes the architecture and design decisions for the Resume/CV website.

## 📐 Project Structure

```
├── app/                      # Next.js App Router
│   ├── layout.tsx           # Root layout, metadata, and the theme bootstrap
│   ├── page.tsx             # Server entry for the resume page
│   ├── blog/                # Blog routes - list, article, tag, per-post OG card
│   ├── admin/               # Authoring, behind the auth guard
│   ├── api/                 # Better Auth endpoints and presigned uploads
│   ├── rss.xml/             # RSS 2.0 feed
│   ├── not-found.tsx        # Site-wide 404, also what a draft looks like
│   ├── robots.ts            # Generated /robots.txt
│   ├── sitemap.ts           # Generated /sitemap.xml - async, queries the database
│   └── globals.css          # Global styles with Tailwind v4
│
├── components/              # Shared UI primitives
│   ├── theme-toggle.tsx     # Light / dark / system switcher
│   └── ui/                  # shadcn/ui base components
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── drawer.tsx
│       ├── popover.tsx
│       ├── section-card.tsx # Card + header composition used by every section
│       ├── section-header.tsx
│       ├── separator.tsx
│       ├── timeline.tsx
│       └── variants.ts      # Visual variant tokens
│
├── features/
│   ├── blog/
│   │   ├── components/      # Cards, list section, article body, chrome
│   │   ├── data/            # Drizzle reads, cache-tagged
│   │   ├── editor/          # The frozen Tiptap extension set
│   │   ├── utils/           # Content pipeline, slug, reading time, JSON-LD
│   │   ├── social-card.tsx  # Per-article link-preview banner
│   │   ├── config.ts        # BLOG_CONFIG and section copy
│   │   └── types.ts         # Post, Tag, PostStatus
│   └── resume/
│       ├── components/      # Feature UI, section cards, and drawer
│       ├── data/            # Resume source content
│       ├── utils/           # Feature-specific derived helpers
│       ├── config.ts        # Resume config and links
│       └── types.ts         # Resume domain types
│
├── lib/                     # Shared, framework-level helpers
│   ├── auth.ts             # Better Auth instance and the allow-list
│   ├── auth-guard.ts       # requireAuthor() - the authorization boundary
│   ├── db/                 # Drizzle schema, client, seed
│   ├── og/                 # Font loading for the server-drawn cards
│   ├── validators/         # Zod schemas
│   ├── theme.ts            # Theme storage key, event, and default
│   └── utils/
│       ├── cn.ts           # Class name utility (clsx + tailwind-merge)
│       ├── date.ts         # Date formatting utilities
│       ├── media.ts        # Cover-image host allow-list
│       └── index.ts        # Barrel export
│
└── public/                  # Static assets
    └── foto-profile.jpg    # Profile image
```

## 🏗️ Architecture Principles

### 1. **Separation of Concerns**

- **Feature ownership**: Resume code lives together under `features/resume/`
- **Data**: Resume source data is separated into `features/resume/data/resume.ts`
- **Types**: Resume domain types live in `features/resume/types.ts`
- **Components**: UI components are separated from business logic
- **Utilities**: Shared utilities stay in `lib/utils/`, while resume-specific derivations live in `features/resume/utils/`

### 2. **Type Safety**

- Full TypeScript implementation
- All data structures are typed
- Component props are strictly typed
- No `any` types used

### 3. **Component Reusability**

- Shared UI primitives in `components/ui/`
- Resume-specific components in `features/resume/components/`
- Base UI components from shadcn/ui
- Consistent component patterns

### 4. **Maintainability**

- Feature-based folder structure
- Smaller focused components for sidebar cards and sections
- Derived values are computed from source data instead of duplicated
- Single source of truth for data

### 5. **Developer Experience**

- TypeScript for autocomplete and type checking
- ESLint for code quality
- Prettier for code formatting
- Clear naming conventions
- Comprehensive README

## 🔄 Data Flow

The site now has two sources of truth, one per feature slice. The resume is a
committed file; the blog is a database. The shape of the two flows is deliberately
identical below the source, so a route composes the same way either way.

```
features/resume/data/resume.ts (Source of Truth)     Neon Postgres (Source of Truth)
    ↓                                                     ↓  lib/db/schema.ts
features/resume/types.ts (Type Definitions)               ↓  features/blog/data/queries.ts
    ↓                                                     ↓  features/blog/types.ts
features/resume/components/resume-page.tsx                ↓  app/blog/** (thin route entries)
    ↓                                                     ↓
features/resume/components/ (Feature Components)     features/blog/components/
    ↓                                                     ↓
components/ui/ (Base UI Components)                  components/ui/
```

## 📦 Key Design Decisions

### Why This Structure?

1. **Scalability**: Easy to add new sections or features
2. **Maintainability**: Clear separation makes updates easy
3. **Testability**: Components and utilities can be tested independently
4. **Reusability**: Components can be reused across the application
5. **Type Safety**: TypeScript catches errors at compile time

### Component Organization

- **Scrolling panes are regions**: any pane that scrolls — a height-capped card
  body or a horizontal rail — is focusable and carries an `aria-label`, so keyboard
  users can reach content that is off-screen
- **Print carries everything**: the sidebar lives in a drawer that unmounts while
  closed, so `resume-page.tsx` renders a print-only copy and `globals.css` drops the
  portalled drawer from the printed sheet
- **Asset paths follow the renderer, not the repo**: react-pdf and Satori both pick
  how to load a font or image from the shape of its `src` - a URL is fetched,
  anything else is opened as a filesystem path. The social card is drawn on the
  server, so `features/resume/social-card.tsx` resolves every asset against
  `process.cwd()`. The PDF is drawn in the browser, so `features/resume/pdf/theme.ts`
  keeps browser-relative sources such as `/fonts/x.ttf`. Swapping either one for the
  other's form breaks quietly: on the server a browser path is a silent ENOENT, and
  in the browser a `process.cwd()` path is fetched as `/public/fonts/...` and 404s
- **The PDF is drawn in the browser, on demand**: `download-resume-button.tsx`
  imports react-pdf and the document dynamically, so the renderer is code-split out
  of the initial bundle and only fetched when someone asks for the file. It stays a
  client render because a server route would put a Node-native renderer, its font
  loading, and a build-time prerender in the path of a file almost nobody requests
- **Section composition**: Every section — the six drawer cards and the three main
  sections — renders through `components/ui/section-card.tsx`, which owns the card
  frame, the header bar, and the `card` / `ghost` variants
- **Content is sanitised on the way out, not on the way in**: article bodies are
  stored as the editor's own ProseMirror document and pass through
  `rehype-sanitize` at render, before the highlighter runs. Sanitising on save
  alone would be a check that stored content can outlive; ordering it before
  `rehype-pretty-code` is what lets the highlighter's own `style` attributes
  survive a filter the author cannot reach. The renderer emits stored attributes
  without judging them - a document carrying `src="javascript:..."` produces
  exactly that - so this is the only thing between the database and the reader
- **The extension set is a compatibility surface**: a stored document only means
  anything against the extensions that produced it, so `BLOG_EXTENSIONS` is one
  exported constant. Removing an extension makes every document containing that
  node render wrong, silently, because an unknown node is dropped rather than
  raised
- **Reading costs no JavaScript, and the extras keep it that way**: the contents
  list is server-rendered anchors, the view counter is an `<img>` rather than a
  beacon - so it counts cached pages and readers with scripting off, which a
  beacon would miss - and the code-copy buttons are attached after load, so a
  reader without JavaScript sees no dead controls rather than broken ones
- **The draft preview is its own route, not a query parameter**: the spec asked
  for `/blog/{slug}?preview=…`, and building it that way turned every article
  from prerendered into on-demand, because a page that reads `searchParams`
  cannot be static. That meant re-running the highlighter on every read of every
  published article to support a feature used a few times a month
- **One path to a session, and the allow-list is on it**: OAuth account linking is
  disabled, because Better Auth's default links an incoming account to an existing
  user matched by verified email - and that path never calls `createUser`, so the
  hook the allow-list lives in would never have run. Any future auth change has to
  keep that property: if there is a second way to get a session, the allow-list has
  to be on that one too
- **A guard that cannot evaluate its input denies**: the absolute session cap used
  to skip itself when `createdAt` was unparseable. Failing open is the default
  shape of a mistake like that, and the only defence is writing the condition the
  other way round
- **`proxy.ts` is a redirect; `requireAuthor()` is the boundary**: a server action
  is a POST identified by a header, reachable without touching the routing the
  proxy sees. So every admin page, every mutating action and the upload route
  re-check authorisation for themselves, and the suite proves it by forging a
  session cookie - which walks past the proxy and must still be refused
- **An absent database is a state, not an error**: `getDb()` returns `null` when
  `DATABASE_URL` is unset and every query returns the empty result, so a fresh
  clone, a CI build and a preview without a branch all build and serve the resume.
  Query failures take the same path, so a database outage renders `/blog` empty
  rather than crashing the only page the site has
- **Article rendering ships no JavaScript**: the markdown pipeline and Shiki run in
  a server component and the page receives finished HTML. That is what keeps the
  article readable with JavaScript disabled, and why theme switching repaints code
  from CSS custom properties rather than by re-highlighting
- **Prose overrides are unlayered**: Tailwind Typography emits its `.prose` rule at
  the same specificity as ours, so source order decides. Anything inside
  `@layer base` is emitted first and silently loses — which showed up as correct
  fonts and wrong colours
- **UI Components** (`components/ui/`): Base design system components
- **Resume Feature** (`features/resume/`): Domain-specific data, types, config, and components
- **Page Components** (`app/`): Thin route entry points

### Data Management

- Resume data stays in one feature-owned file for easy updates
- Data is typed for safety
- Derived values such as age are computed from raw data

## 🛠️ Development Workflow

1. **Update Data**: Edit `features/resume/data/resume.ts`
2. **Add Types**: Update `features/resume/types.ts` if needed
3. **Create Components**: Add feature components under `features/resume/components/` or shared primitives under `components/ui/`
4. **Use in Pages**: Compose feature entry points from `app/page.tsx`

## 📝 Code Style

- **TypeScript**: Strict mode enabled
- **Naming**: PascalCase for components, camelCase for functions
- **Imports**: Absolute imports using `@/` alias
- **Formatting**: Prettier with consistent config
- **Linting**: ESLint with Next.js config

## 🚀 Future Improvements

Potential enhancements:

- [x] Add E2E tests with Playwright
- [x] Add a downloadable PDF export of the resume - react-pdf, rendered client-side
- [x] Add analytics - PostHog, key-gated
- [x] Surface contact details in the hero (email, LinkedIn, GitHub)
- [ ] Add unit tests with Vitest — slug collision, reading time, the content
      pipeline, preview tokens and the Zod schemas are the pure logic worth covering
- [ ] Complete the Content-Security-Policy: `script-src` and `style-src` need a
      per-request nonce, which needs middleware and would make every prerendered
      page dynamic. The nonce-free directives are already in place
- [ ] Full-text search, then `pgvector` semantic search
      (see `docs/blog-implementation-plan.md`)
- [ ] Add Storybook for component documentation
- [ ] Add i18n support for multiple languages
- [ ] Enforce import ordering with an ESLint rule
- [ ] Cookie-consent gate before analytics runs for UK/EU visitors
