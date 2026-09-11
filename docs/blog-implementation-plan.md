# Blog — Implementation Plan

Status: Phases 0–4 implemented and reviewed; awaiting merge
Owner: Indra Cahya Edytya

| Branch                           | Covers                                        | State                                         |
| :------------------------------- | :-------------------------------------------- | :-------------------------------------------- |
| `feat/blog-data-and-public-read` | Phases 0–2 — data layer, public read, SEO     | Pushed, reviewed, awaiting merge to `develop` |
| `feat/blog-auth-and-admin`       | Phase 3 — content model, auth, admin, uploads | Stacked on the above; awaiting review         |

Source documents, both committed alongside this one:

- [`docs/blog-prd.md`](./blog-prd.md) — what "done" and "hardened" mean, as executable acceptance criteria
- [`docs/blog-spec.md`](./blog-spec.md) — how to build it

This plan is the reconciliation between those two and the repository as it
actually stands today. Where it departs from them, §1 and §9 say so and why.

---

## 1. What changed since the spec was written

`blog-spec.md` was revised against `555f5dd` (31 Aug 2026). `develop` is now at
`f152a1c`, and four of the things the spec flags as open are already closed.

| Spec says                                             | Reality on `develop`                                                                                 | Consequence                                                                    |
| :---------------------------------------------------- | :--------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------- |
| "Deployed site is ahead of `main`" — no OG route      | `app/opengraph-image.tsx` and `features/resume/social-card.tsx` both exist and are covered by a spec | §0 item 2 is resolved. Nothing to reconcile.                                   |
| "Tests: **None.** Vitest/Playwright are on a roadmap" | `playwright.config.ts` + 6 spec files in `e2e/`, run against a production build                      | The E2E harness already exists. Blog specs extend it rather than introduce it. |
| "no env beyond `NEXT_PUBLIC_SITE_URL`"                | `.env.example` documents three vars; PostHog is wired and key-gated                                  | There is an established pattern for optional, absent-by-default configuration. |
| Feature specs have no home                            | `docs/tier-1-discoverability-and-contact.md`                                                         | `docs/` is where this plan and its sources live.                               |

**Still open and addressed here:** §0 item 1 (deploy target — see D1), and §0's
dependency-placement cleanup.

## 2. Decisions taken before coding

Four questions the spec left genuinely open, answered before any file was
touched.

| #      | Question                | Decision                                      | What it determines                                                                                                                                                                                         |
| :----- | :---------------------- | :-------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D1** | Deploy target           | **Cloudflare Workers**                        | `@opennextjs/cloudflare` + `wrangler`; R2 for cover storage in Phase 3; `@neondatabase/serverless` is now mandatory, not merely convenient — Workers cannot open raw TCP sockets, so `pg` would never work |
| **D2** | Scope of this branch    | **Phases 0–2** — data layer, public read, SEO | No auth, no admin, no authoring UI, no uploads. The spec is explicit that auth lands before authoring; this branch lands neither, so that ordering is preserved rather than broken                         |
| **D3** | Database for this build | **Local Postgres in Docker**                  | A `docker-compose.yml` with Postgres plus a Neon-compatible HTTP proxy, so application code runs one driver in every environment. Neon itself stays for production                                         |
| **D4** | Article typeface        | **Inter, scoped to `.prose`**                 | Site chrome, nav, headings and code stay JetBrains Mono. Only the article body changes face                                                                                                                |

### D1 in detail — why the adapter lands additively

Adding Cloudflare does **not** change `npm run build`. `wrangler.jsonc`,
`open-next.config.ts` and the new `preview` / `deploy` scripts are inert until
`opennextjs-cloudflare build` is run explicitly. The existing build, the
existing E2E suite, and any current deployment all behave exactly as before.
This is deliberate: a runtime migration and a feature branch should not be the
same review.

`@opennextjs/cloudflare@1.20.6` declares `next: ">=15.5.24 <16 || >=16.3.3"` —
verified against the repo's `next@16.3.3`, which is the first supported v16.

### D3 in detail — why a proxy rather than a second driver

`@neondatabase/serverless` speaks Neon's HTTP protocol, which a stock Postgres
does not. The two ways to develop against a local database are:

1. Branch the driver — `neon-http` in production, `postgres-js` over TCP
   locally. Rejected: it puts a Node-only TCP driver in the dependency graph of
   a Workers build, and it means the code under test is not the code that ships.
2. Put a Neon-protocol proxy in front of local Postgres. Chosen. One driver, one
   code path, `DATABASE_URL` is the only thing that differs between environments.

## 3. Scope

**In:** everything a reader and a crawler touch.

- Schema, migrations, and a typed read layer (`posts`, `tags`, `post_tags`)
- `/blog`, `/blog/[slug]`, `/blog/tag/[tag]`, and a styled `not-found`
- Prose typography: the Tailwind typography plugin, `--font-prose`, prose tokens
  wired to existing semantics, server-side syntax highlighting
- Per-post metadata, `Article` + `BreadcrumbList` JSON-LD, per-post OG image
- `sitemap.ts` made async, `/rss.xml`, `/admin` disallowed in `robots.ts`
- A "Writing" section on the resume homepage — see §9, note 1
- Playwright coverage in two tiers — see §7

**Out, and deliberately so:** authentication, `/admin`, Tiptap, server actions,
cover uploads, draft preview tokens, table of contents, related posts, view
counter, comments, search. Cover **rendering** is in; cover **uploading** is not.

## 4. Dependencies

| Package                                                                    | Where      | Why                                                              |
| :------------------------------------------------------------------------- | :--------- | :--------------------------------------------------------------- |
| `drizzle-orm`, `@neondatabase/serverless`                                  | dependency | Query layer and the only driver that works on Workers            |
| `unified`, `remark-parse`, `remark-gfm`, `remark-rehype`                   | dependency | Markdown → hast                                                  |
| `rehype-sanitize`, `rehype-slug`, `rehype-pretty-code`, `rehype-stringify` | dependency | Sanitising, heading ids, highlighting, serialisation             |
| `shiki`                                                                    | dependency | Peer of `rehype-pretty-code`; runs server-side only              |
| `reading-time`                                                             | dependency | Computed on write, stored on the row                             |
| `zod`                                                                      | dependency | Validates seed input now, server actions in Phase 3              |
| `@tailwindcss/typography`                                                  | dependency | Registered via `@plugin` in CSS — Tailwind v4 has no config file |
| `drizzle-kit`, `tsx`                                                       | dev        | Migration generation, seed execution                             |
| `@opennextjs/cloudflare`, `wrangler`                                       | dev        | D1                                                               |

**Also moved, not added** (spec §0, "minor cleanup"): `@radix-ui/react-avatar`,
`@radix-ui/react-separator`, `@radix-ui/react-slot`, `tailwindcss` and
`@tailwindcss/postcss` move from `devDependencies` to `dependencies`. They are
required to build and to render. This works today only because the current host
does not prune dev dependencies; a Workers build pipeline may.

## 5. File plan

`(A)` added, `(M)` modified.

```
docker-compose.yml                       (A) postgres + neon http proxy
drizzle.config.ts                        (A)
drizzle/                                 (A) generated migration + journal
open-next.config.ts                      (A) D1
wrangler.jsonc                           (A) D1

lib/
  db/
    index.ts                             (A) lazy neon+drizzle client, absent-safe
    schema.ts                            (A)
    seed.ts                              (A) three posts, run via tsx
  og/
    brand-fonts.ts                       (A) fs-then-fetch font loader (§9 note 3)
  validators/
    blog.ts                              (A) zod schemas
  utils/
    media.ts                             (A) cover-URL host allow-list (T-6)

features/blog/
  components/
    post-card.tsx                        (A)
    post-list-section.tsx                (A)
    post-content.tsx                     (A) renders the sanitised HTML
    post-meta.tsx                        (A) <time>, reading time, tags
    tag-pill.tsx                         (A)
    pagination.tsx                       (A) crawlable <a>, not a JS control
    post-cover.tsx                       (A)
  data/
    queries.ts                           (A) all reads, cache-tagged
  utils/
    markdown.ts                          (A) the unified pipeline
    reading-time.ts                      (A)
    slug.ts                              (A)
    structured-data.ts                   (A) Article + BreadcrumbList
  social-card.tsx                        (A) per-post 1200x630
  config.ts                              (A) BLOG_CONFIG, SECTION_COPY.blog
  types.ts                               (A)

app/
  blog/
    page.tsx                             (A) list + pagination
    [slug]/page.tsx                      (A)
    [slug]/opengraph-image.tsx           (A)
    tag/[tag]/page.tsx                   (A)
  rss.xml/route.ts                       (A)
  not-found.tsx                          (A) styled 404 (PRD US-1.1)
  sitemap.ts                             (M) becomes async, queries posts
  robots.ts                              (M) disallow /admin
  layout.tsx                             (M) Inter as --font-prose; RSS <link>
  globals.css                            (M) typography plugin, prose tokens, shiki

features/resume/
  components/writing-section.tsx         (A) homepage "Writing" section
  components/resume-page.tsx             (M) mounts it
  config.ts                              (M) SECTION_COPY.writing

next.config.ts                           (M) images.remotePatterns, dev bindings
package.json                             (M) deps, dep placement, db:* scripts
playwright.config.ts                     (M) pass DATABASE_URL through
.env.example                             (M) DATABASE_URL, NEXT_PUBLIC_MEDIA_ORIGIN
.gitignore                               (M) .dev.vars, .open-next, .wrangler
ARCHITECTURE.md                          (M) the blog slice, static → DB
README.md                                (M) env vars, docker, db scripts
e2e/blog.spec.ts                         (A) tier 1 — runs anywhere
e2e/blog-content.spec.ts                 (A) tier 2 — needs a seeded database
```

## 6. Build order

Each step is independently reviewable and leaves the tree green.

1. **Phase 0 — runtime.** Dependency placement, Cloudflare adapter, gitignore.
   `npm run build` must be byte-for-byte equivalent in behaviour afterwards.
2. **Phase 1a — schema.** `lib/db/schema.ts`, `drizzle.config.ts`, generate the
   migration. No application code reads it yet.
3. **Phase 1b — local database.** `docker-compose.yml`, migrate, seed, verify
   rows come back typed.
4. **Phase 1c — query layer.** `features/blog/data/queries.ts`, cache-tagged and
   absent-safe.
5. **Phase 2a — typography.** Plugin, `--font-prose`, prose tokens, shiki CSS.
   Verifiable on its own against a hand-written sample before any route exists.
6. **Phase 2b — routes.** List, article, tag, not-found.
7. **Phase 2c — SEO.** Metadata, JSON-LD, async sitemap, RSS, per-post OG image.
8. **Phase 2d — homepage tie-in and docs.**
9. **Verification.** `npm run check`, `npm run build`, both E2E tiers, print
   preview, both themes.

## 7. Test plan

The existing suite runs against a real production build. Blog coverage splits in
two so the suite stays runnable by anyone who clones the repo.

**Tier 1 — `e2e/blog.spec.ts`.** No database required. Asserts the routes exist
and degrade correctly: `/blog` renders its empty state rather than crashing, an
unknown slug 404s, `/rss.xml` is well-formed RSS 2.0 with the right content
type, `/sitemap.xml` contains `/blog`, `robots.txt` disallows `/admin`, and
every page advertises the feed via `<link rel="alternate">`.

**Tier 2 — `e2e/blog-content.spec.ts`.** Skipped unless `DATABASE_URL` is set.
Asserts seeded content: posts list newest-first, an article renders its body
with JS disabled, drafts and archived posts 404, tag pages filter correctly and
exclude drafts, code blocks are highlighted server-side with no highlighting
library in the client bundle, exactly one `<h1>`, `Article` JSON-LD parses.

Both tiers are Playwright, extending `playwright.config.ts` rather than
replacing it. Vitest is **not** introduced here — the pure logic worth unit
testing (slug collision, reading time, the sanitiser) mostly belongs to the
authoring path, which this branch does not build. It lands with Phase 3.

## 8. Acceptance criteria covered

From `blog-prd.md`, by story:

- **Fully covered:** US-1.1, US-1.2, US-1.3, US-2.1, US-2.2, US-2.3, US-5.1,
  US-5.2, US-5.3
- **Partially covered:** US-6.2 — a database failure on `/blog` renders a
  graceful empty state and logs server-side; correlation IDs and the admin-side
  half land with Phase 3
- **Not in this branch:** every story under E3 (authoring), E4 (access control),
  and US-6.1 (rollback rehearsal)

From the threat model, mitigated here: **T-2** (output sanitising), **T-4**
(drafts 404, absent from sitemap and feed), **T-6** (`remotePatterns` restricted
to one configured host), **T-7** (Drizzle parameterises; no raw SQL
concatenation). **T-1, T-3, T-5, T-8, T-9** concern surfaces this branch does not
create. **T-10** applies now: `DATABASE_URL` is server-only and must never gain a
`NEXT_PUBLIC_` prefix.

## 9. Departures from the source documents

**1. The homepage "Writing" section (US-2.3) is included, though the PRD's phase
map puts it in Phase 6.** A public read path with no entry point from the only
page the site currently has is not deliverable. It is one `SectionCard`, it is
omitted entirely when there are no published posts (which is its stated
acceptance criterion anyway), and it is trivially revertible. Print output is
verified unregressed.

**2. `unstable_cache`, not `"use cache"`.** Next 16.3.3 exports both, but the
`"use cache"` directive requires `cacheComponents: true`, which flips the whole
application to dynamic-by-default with explicit opt-in caching. That is a
site-wide behavioural change and does not belong in a feature branch.
`unstable_cache` accepts the same tags and is invalidated by the same
`revalidateTag` calls Phase 3 will make, so the migration later is mechanical.

**3. OG image fonts are loaded filesystem-first, network-second.** The existing
resume card reads its fonts through `node:fs` against `process.cwd()`, which is
correct because that route is prerendered during `next build`. A per-post card
cannot rely on that: a post published after the last deploy renders its card on
demand, and a Workers isolate has no filesystem. `lib/og/brand-fonts.ts` tries
the filesystem and falls back to fetching from the deployment's own `/fonts`.
The render is wrapped so a failure serves the site-level card rather than a
broken response — which is what US-5.3 asks for. The resume card is left
untouched; it works, it is prerendered, and it is covered by a passing spec.

**4. `wrangler.jsonc`, not `wrangler.toml`.** The spec names the TOML file;
JSONC is what current `@opennextjs/cloudflare` documents and generates, and it
supports comments, so nothing is lost.

**5. No incremental cache binding yet.** `open-next.config.ts` ships with
defaults. Wiring R2 as the incremental cache and a tag cache is only meaningful
once something mutates, so it lands with Phase 3. Until then, pages re-query on
a cache miss, which is correct if not optimal.

**6. Covers render but cannot be uploaded.** `coverUrl` and `coverAlt` are in
the schema because the schema is specified whole, and `PostCover` renders them
with explicit dimensions for US-2.1's CLS criterion. But `next/image` will only
load a host present in `images.remotePatterns`, and that list is built from
`NEXT_PUBLIC_MEDIA_ORIGIN`. With the variable unset — its state on this branch,
since Phase 3 owns R2 — `isAllowedMediaUrl()` returns false and no cover
renders. This keeps T-6 shut by default rather than leaving the image host open
in anticipation.

## 10. Definition of done for this branch

- [x] `npm run check` clean — format, lint, `tsc --noEmit`, no `any`
- [x] `npm run build` succeeds with `DATABASE_URL` set **and** unset
- [x] Tier 1 E2E green without a database; tier 2 green against the seeded one
- [x] Both themes verified by eye on `/blog` and an article, including code blocks
- [x] Resume page and its print output unregressed
- [x] `ARCHITECTURE.md` and `README.md` updated
- [x] No secret committed; `.env.example` carries placeholders only

---

## 11. Implementation notes

What the build actually taught us, recorded against the plan above rather than
quietly diverging from it.

### 11.1 Five bugs the work uncovered

Each was found by running the thing, not by reading it. All five were silent —
the code compiled, the build passed, and the page rendered.

**Footnote anchors were broken by double-prefixing.** `remark-rehype` already
namespaces the ids it generates for GFM footnotes, and prefixes the hrefs
pointing at them to match. `rehype-sanitize` then prefixed the ids a second time
but not the hrefs, so every footnote link pointed at `#user-content-fn-1` while
the target had become `user-content-user-content-fn-1`. Fixed with
`clobberPrefix: ""`, which is safe here only because there is no
author-controlled path to an `id` at all.

**Heading levels skipped.** The first attempt demoted every heading by one so an
authored `#` could not become a second `<h1>`. That satisfied half of US-1.1 and
broke the other half: a post written with `##` — which is how both seeded posts
are written — came out as `h3` directly under the title's `h1`. Replaced with a
normalisation that computes the shift from the document, so the shallowest
heading becomes `h2` whether the author started at `#` or `##`.

**Tables pushed the page sideways on a phone.** Code blocks scroll inside their
own box because `rehype-pretty-code` gives them one. Tailwind Typography gives
tables nothing, so a three-column table overflowed the viewport at 375px. The
rehype plugin now wraps every table in a focusable, labelled scroll region — the
same treatment `components/ui/card.tsx` already gives its scroll panes.

**Every prose colour override was silently losing the cascade.** They were
written inside `@layer base`, which Tailwind emits _before_ the typography
plugin's own `.prose` rule. Same specificity, earlier in the file, so the plugin
won. The failure was partial and therefore easy to miss: `font-family` still
applied, because the plugin does not set it — so the typography looked right and
only the colours were wrong. Code blocks rendered on Typography's default dark
slate in _both_ themes. Moved to unlayered CSS at the end of `globals.css`,
alongside the shadow and gradient utilities that were already there.

**The per-post OG card was always the fallback.** `params` is a `Promise` in
Next 16, and typing it as a plain object compiles. `params.slug` was
`undefined`, `getPostBySlug` found nothing, and the route redirected to the site
card — which looks exactly like the intended graceful degradation. Caught only
by requesting the URL and noticing a 307 where a PNG was expected.

### 11.2 Corrections to §4 and §5

| Planned                                        | Built                                     | Why                                                                                                                                                                                            |
| :--------------------------------------------- | :---------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PostCover` uses `next/image`                  | Plain `<img>` with explicit dimensions    | The default image optimiser does not run on Cloudflare Workers, so the component would work locally and fail in production — and it cost 15KB of client JS on a page that otherwise ships none |
| `next.config.ts` gains `images.remotePatterns` | No image config at all                    | Dead config once `next/image` is not the renderer. The host allow-list lives solely in `lib/utils/media.ts`, so there is one gate rather than two that can drift                               |
| —                                              | `pg`, `@types/pg` (dev)                   | `drizzle-kit` picks its driver from what is installed. With only `@neondatabase/serverless` present it tried to reach local Postgres over a Neon websocket and hung with no error              |
| —                                              | `server-only`, `@types/mdast` (dev)       | Enforces that the query layer cannot be imported from a client component; types the heading-normalisation plugin without `any`                                                                 |
| —                                              | `lib/db/dev-env.ts`                       | `drizzle-kit` and the seed are plain Node processes started outside Next, so they see nothing in `.env.local` unless it is loaded explicitly                                                   |
| —                                              | `features/blog/components/blog-shell.tsx` | The blog chrome is a component rather than an `app/blog/layout.tsx` so `app/not-found.tsx` at the root can reuse it — a layout would not wrap that                                             |
| —                                              | `components/ui/section-header.tsx` (M)    | It forced `target="_blank"` on every section link, which was correct while every link was external. A same-site link to `/blog` must not steal the tab                                         |
| Postgres on 5432                               | Postgres on 55432                         | The development machine already had one on 5432. A stack that refuses to start because it collided is a worse default than an unfamiliar port                                                  |

### 11.3 Verification performed

- `npm run check` — Prettier, ESLint and `tsc --noEmit` all clean, no warnings, no `any`.
- `npm run build` — succeeds with `DATABASE_URL` set (published posts prerender
  via `generateStaticParams`) and with it unset (nothing to prerender, build
  still green).
- `npm run test:e2e` — **38 passing** with the seeded database: 15 new blog specs
  plus the 23 pre-existing ones, unregressed. Without a database, **27 passing
  and 11 skipped**, which is the intended tier-1-only run.
- The markdown pipeline was exercised directly against the threat model: stored
  `<script>`, `<img onerror>`, `javascript:` and `data:` hrefs, an inline event
  handler and an `<iframe>` are all stripped, while GFM tables, task lists,
  footnotes and `mailto:` survive — 18 assertions, all passing.
- The per-article OG card was rendered and looked at, not merely asserted on.
- Both themes were screenshotted on `/blog`, an article, a tag page and the 404,
  and inspected — including code blocks, inline code, tables and the tag pills.
- Print preview checked: the Writing section is absent from paper, the resume's
  own sections and its print-only sidebar copy are unchanged.
- Client bundles were diffed per route and grepped: no `shiki`, `rehype`,
  `drizzle`, `neondatabase` or `DATABASE_URL` fragment reaches the browser.
- The seed was run twice to confirm it is idempotent (3 posts, 6 tags, 7 joins
  both times).

### 11.5 Review round

The branch was reviewed for security and for conventions before it was committed,
and an axe scan and a dependency audit were run. Fourteen findings were acted on;
the rest are recorded in §11.6 as accepted.

**Security**

| #    | Finding                                                                                                                                                                                                     | Fix                                                                                                                                                                                               |
| :--- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-11 | `?page=` was an unbounded cache key. The page number reached `unstable_cache` before being clamped, so `?page=1` … `?page=1000000` were a million distinct misses, two queries each, all returning page one | `features/blog/utils/page-param.ts` clamps at the route boundary, against `BLOG_CONFIG.maxPage`                                                                                                   |
| —    | Markdown body images allowed `http:`, which is mixed content on an HTTPS page                                                                                                                               | The sanitiser's `protocols.src` is now `["https"]`                                                                                                                                                |
| —    | No security response headers at all                                                                                                                                                                         | HSTS, `nosniff`, `Referrer-Policy` and `X-Frame-Options` in `next.config.ts`, covered by a spec. CSP still deferred — it needs a nonce for the inline theme script, which needs middleware (T-12) |
| —    | Heading ids from `rehype-slug` were unprefixed, so a heading could slug to `document` or `__next` — a DOM-clobbering surface. The comment claimed no author-controlled id path existed, which was wrong     | `rehypeSlug` now takes `prefix: "user-content-"`, and the comment says what is actually true                                                                                                      |
| —    | `docker-compose.yml` bound Postgres to every interface with a two-word password                                                                                                                             | Both ports bound to `127.0.0.1`                                                                                                                                                                   |
| —    | `db.localtest.me` in the local-host allow-list resolves through public DNS, and matching it forces cleartext                                                                                                | Loopback only. Verified the proxy works with `127.0.0.1`                                                                                                                                          |
| —    | RSS escaped the five entities but not the control characters XML forbids outright, any one of which makes the whole feed unparseable                                                                        | Stripped before escaping                                                                                                                                                                          |
| —    | A database outage made published articles answer **404**, which a crawler reads as "deleted"                                                                                                                | `getPostBySlug` no longer swallows errors; `app/error.tsx` renders a 500 with the correlation id. Lists, feed and sitemap still degrade to empty                                                  |
| —    | `.env.example` described `next/image` and `images.remotePatterns` governing covers — a mechanism removed earlier in the branch                                                                              | Corrected to name `isAllowedMediaUrl` as the only gate                                                                                                                                            |

**Accessibility** — axe reported four serious/critical violations that no other check caught:

- GFM task-list checkboxes had no label at all (`critical`). They now take the list item's own text as their `aria-label`.
- `github-light` failed AA on this surface: its red at 4.42:1, green at 4.47:1, orange at 3.37:1. Switched to `github-light-high-contrast`.
- The tag-pill count faded to `opacity-70` measured 4.32:1. The opacity is gone; the parentheses already did the de-emphasis.
- `/blog` and `/blog/tag/[tag]` had **no `<h1>`**, then skipped h1 → h3 once one was added. `SectionHeader` and `CardTitle` both take a heading level now, defaulting to what the resume already used.

**Correctness and conventions**

- Paginated pages canonicalised to page one, which tells a crawler page two is a duplicate — undoing the whole reason the pagination is built from real links. Both list routes now self-canonicalise.
- `Inter` was preloaded on the resume, a page that never renders a glyph of it. `preload: false`.
- The feed ran the markdown stripper over an already-plain excerpt, eating `snake_case` underscores. It now escapes the stored excerpt directly.
- `<Link>` pointed at `/rss.xml`, a route handler, which Next would try to prefetch as an RSC payload. Plain `<a>`.
- Eight unused symbols deleted (`getTagBySlug` — the one unfiltered read, and a landmine for a future caller — plus `uniqueSlug`, `isValidSlug`, `isDatabaseConfigured`, `PostStatus`, `Post.status`, `Post.createdAt`, `PaginatedPosts.total`). They land with the phase that needs them.
- Duplication removed: `SITE_HOST` existed five times (three of them predating this branch) and `absoluteUrl` three; both now live in `features/resume/config.ts`. The OG palette and font loading are shared by both cards through `lib/og/`. `serialiseJsonLd` and the bordered-control class string each had two copies.
- Cache wrappers hoisted to module scope; raw `sql` replaced with `isNotNull`; the homepage strip uses a `getRecentPosts(3)` instead of fetching ten posts to show three; the three avoidable casts in the markdown pipeline are gone, and typing it properly is what caught an unchecked heading-depth clamp.

### 11.6 Known gaps, deliberately left

- **Playwright cannot install its own Chromium on this machine** (macOS 13 is no
  longer supported by current Playwright builds). The suite was run against the
  system Chrome via a temporary `channel: "chrome"` override, which was **not**
  committed — `playwright.config.ts` still uses the bundled browser, which is
  what CI wants. Anyone on macOS 13 will need the same local override.
- **`workerd`'s install script is blocked** by this machine's npm settings, so
  `npm run preview` and `npm run deploy` have not been exercised. Approve it with
  `npm install-scripts approve workerd` before the first Cloudflare build.
- **`next/image` in `hero-section.tsx` predates this branch** and will need a
  Cloudflare Images loader or a plain `<img>` when the Workers migration actually
  happens. Out of scope here; flagged because D1 makes it relevant.
- **No incremental cache binding**, per §9 note 5. Until Phase 3 wires R2, a
  cache miss re-queries.
- **Vitest is still not introduced.** The pure logic worth unit-testing mostly
  belongs to the authoring path; the markdown pipeline was verified with a
  throwaway harness rather than a committed suite, and deserves a real one when
  Vitest lands.
- **No CSP.** The remaining item from PRD §4's transport list. It needs a
  per-request nonce for the inline theme script in `app/layout.tsx`, which needs
  middleware — and middleware arrives with the authoring phase anyway. Getting it
  wrong ships a site with no theme, so it is not a change to make in passing.
- **axe is not in the committed suite.** It was run manually — zero violations at
  any severity across `/`, `/blog`, an article, a tag page and the 404, in both
  themes. Landing `@axe-core/playwright` as a spec would keep it that way, and
  belongs with the same pass that adds Vitest.
- **`drizzle-kit` carries four moderate advisories** through
  `@esbuild-kit/esm-loader` → an old `esbuild`. It is a dev-only CLI, never
  bundled and never run in production; `npm audit --omit=dev` reports zero. The
  latest `drizzle-kit` still has them, so there is nothing to upgrade to.
- **Body images may point at any HTTPS host.** An embedded image tells its host
  the reader's IP and user agent. The same trade GitHub makes, and only the author
  can write one — but it is a trade, not an oversight.
- **Dependabot is not configured** (PRD T-13). It opens pull requests against the
  repository, which is the owner's call rather than a code change.

---

## 12. Phase 3 — auth and authoring

Branched from `feat/blog-data-and-public-read` rather than from `develop`,
because it depends on the data layer that branch adds. Review and merge them in
order.

### 12.1 The decision that reshaped the data layer

The spec named Tiptap as the editor and markdown as the storage format, which do
not fit together: Tiptap is a rich-text editor over a ProseMirror document, and
serialising that to markdown on every save is a lossy round trip, not a format.
Asked, the answer was **Tiptap with the document stored as JSON** — so the body
column became `jsonb` and the article render path was rebuilt around it.

The concern raised at the time, and still true: ProseMirror JSON only means
anything against the extension set that produced it. Remove or change an
extension and every document containing that node renders wrong — silently,
because an unknown node is dropped rather than raised. Markdown does not have
that property. `BLOG_EXTENSIONS` is therefore one exported constant with the
consequence written next to it, and changing it is a migration, not a config edit.

What did **not** change is the security and accessibility work from Phase 2. The
document is rendered to HTML by Tiptap's DOM-free static renderer, and that HTML
goes through the same rehype chain — sanitise, then slug, then highlight. If
anything the sanitiser matters more: the renderer emits stored attributes without
judging them, and a document carrying `src="javascript:alert(1)"` produces exactly
that, which was confirmed by rendering one.

`@tiptap/html` was not usable: it declares a `happy-dom` peer, and a Cloudflare
Workers isolate has no way to provide one. `@tiptap/static-renderer` needs no DOM.

Migration is expand/contract per US-6.1: `content_json` added, `content` relaxed
to nullable and now written by nothing, dropped a release later. That leaves rows
with a body in the old column and none in the new — a state the archive has to
handle, so **being published now also requires having a document**. Found by
leaving exactly such a row behind locally, where it sat in the feed and the
sitemap while answering 404 when opened.

### 12.2 The authorization boundary

`proxy.ts` — `middleware.ts` under its Next 16 name — redirects a browser with no
session cookie away from `/admin` and sets `X-Robots-Tag`. It checks presence
only, never validity.

That is deliberate, and the reason is worth stating: a server action is a POST
identified by an id in a header, reachable without touching the routing a proxy
sees. So the check that decides is `requireAuthor()` in `lib/auth-guard.ts`,
called by every admin page, every mutating action, and the upload route. It
re-tests four things on every call — session validity, absolute session age, the
allow-list, and that the identity is GitHub's immutable numeric id rather than a
username.

The suite proves the two paths separately. One test sends no cookie and asserts
the 307 to the login page. The other sends a **forged** cookie, which walks
straight past the proxy, and asserts the action rejects it, returns only an error
digest with no stack trace, and writes nothing. Both invoke a real action id
lifted from the build's own manifest — an invented one is rejected by Next before
any application code runs, which would make the test pass while proving nothing.

### 12.3 What Phase 3 added

| Area          | Files                                                                                                                                                         |
| :------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Content model | `lib/db/schema.ts` (jsonb), `features/blog/editor/extensions.ts`, `features/blog/utils/content.ts`, migration `0001`                                          |
| Auth          | `lib/auth.ts`, `lib/auth-guard.ts`, `lib/auth-client.ts`, `lib/db/auth-schema.ts` (generated), `app/api/auth/[...all]/route.ts`, `proxy.ts`, migration `0002` |
| Admin         | `app/admin/**`, `features/blog/components/admin/**`, `features/blog/data/admin-queries.ts`, `features/blog/data/mutations.ts`                                 |
| Uploads       | `app/api/upload/route.ts`, `features/blog/components/admin/image-upload.tsx`                                                                                  |
| Tests         | `e2e/admin-boundary.spec.ts`                                                                                                                                  |

`lib/db/auth-schema.ts` is generated by `@better-auth/cli`, which needs a
statically-exported `auth` instance. `lib/auth.ts` deliberately has none — it is
built lazily so an unconfigured deployment still builds — so regenerate it from a
throwaway config mirroring its options, then delete that file.

### 12.4 Decisions worth knowing about

- **`updateTag`, not `revalidateTag`.** Next 16 made the latter take a cache-life
  profile and expire lazily. The former is the server-action form and expires
  immediately with read-your-own-writes, which matters because the author is
  redirected to the page they just saved — being shown the previous version of
  their own edit reads as data loss.
- **`aws4fetch`, not the AWS SDK.** R2 presigning needs a SigV4 signer and nothing
  else; the SDK is megabytes on a runtime with a bundle-size limit.
- **The upload never passes through the application.** The server mints a
  short-lived, single-key URL and the browser PUTs directly to storage. A Worker
  has neither the memory nor the time budget to proxy a five-megabyte image.
- **The key is generated, never taken from the client.** A caller-supplied name is
  how an upload overwrites something else or escapes its prefix.
- **Link `rel` and `target` are set at render, not read from the document.** The
  sanitiser allows neither on an anchor, so whatever is stored for them is already
  gone — which is what makes it safe to set them ourselves.
- **`clobberPrefix` reverted to the default.** It was overridden in Phase 2 to
  keep GFM footnote anchors intact. Tiptap has no footnotes, so the exception no
  longer has a reason, and the safer default is back.

### 12.5 Verification performed

- `npm run check` clean; builds with the database and OAuth configured **and**
  with nothing configured at all.
- `npm run test:e2e` — **48 passing**, up from 40: eight new boundary specs plus
  the existing suite unregressed.
- Public route bundles were audited per route: no ProseMirror, no Tiptap, no
  Shiki, no rehype, no Drizzle, no Neon driver and no Better Auth code reaches a
  reader (NFR-5, NFR-6). The editor is behind `next/dynamic` with `ssr: false`.
- The document render path was exercised against every seeded post: no `<h1>` in
  a body, no level skipped, code tokenised in both themes, tables and task lists
  in named scroll regions, inline styles stripped, links carrying `rel`.
- A forged session cookie was driven end to end by hand before being written as a
  test, and confirmed to leave the database unchanged.

### 12.6 Gaps in Phase 3, stated plainly

- **The authenticated admin UI has not been exercised.** Everything compiles,
  every route builds, and the boundary is tested from the outside — but the post
  list, the Tiptap editor, save, publish and delete have not been driven by a
  signed-in session, because minting a valid Better Auth session outside its own
  sign-in flow proved fiddly and the time was better spent on the boundary. **This
  is the thing to check first on first sign-in.**
- **The GitHub round trip is untested**, by design: testing it means either a mock
  proving a mock behaves like a mock, or real credentials in the suite. The
  allow-list logic those credentials would exercise is `requireAuthor()`, which
  every boundary test runs through.
- **The upload path is untested end to end.** No R2 bucket exists. The refusal
  path — an unauthenticated caller gets nothing and no URL is minted — is tested.
- **Session expiry is enforced but not tested.** Idle expiry is Better Auth's; the
  absolute cap is checked against `session.createdAt` in `requireAuthor()`.
  Covering it needs a session, so it is blocked on the same gap as the first item.
- **Still no CSP.** `proxy.ts` now exists, which is what a nonce needs, so the
  blocker named in §11.6 is gone — but it was not attempted here, and a wrong CSP
  ships a site with no theme.

---

## 13. Phase 4 — polish

Everything the spec lists under Phase 4: a table of contents, related posts, a
code-copy button, signed draft previews and a view counter. Plus the gap Phase 3
left open, which turned out to be worth closing first.

### 13.1 The gap from Phase 3, closed — and what it was hiding

Phase 3 shipped with the authenticated admin unverified, because minting a Better
Auth session outside its own sign-in flow defeated a first attempt. It defeated a
second and third too. The answer turned out to be two things, neither obvious and
both failing as a silent `null` session:

1. The cookie is **signed** — the value is `${token}.${signature}`, not the bare
   token `createSession` returns.
2. `npm run start` sets `NODE_ENV=production`, which turns on `useSecureCookies`,
   which **renames the cookie** to `__Secure-better-auth.session_token`.

The first request that got through returned **500**. `listAllPosts` used a raw
``sql`… = any(${postIds})` `` where the rest of the codebase uses Drizzle's
`inArray`, and Postgres rejected it with `42809`. So the admin list page — the
first thing an author sees after signing in — had never worked, and nothing in
the build, the type checker, the linter or the boundary tests could have said so.

That is now `e2e/support/session.ts` and `e2e/admin-authoring.spec.ts`: the whole
lifecycle, driven as the author. Write a post, save it as a draft, confirm it is
absent from every public surface, share it by preview link, publish it, watch the
feed and sitemap pick it up, unpublish it, watch them let it go, delete it after
being asked. Seven tests.

The session is minted through Better Auth's own internal adapter — the same code
path the real GitHub callback uses once GitHub has answered — so everything after
that point is the production path, unmodified. The GitHub round trip itself
remains untested, for the reasons §12.6 gives.

### 13.2 Departure: the preview is its own route

The spec and PRD both specify `/blog/{slug}?preview={token}`, and it was built
that way first. The build output showed why that is the wrong shape:

```
before:  ● /blog/a-database-that-is-allowed-to-be-absent   (prerendered)
after:   ƒ /blog/[slug]                                    (on demand)
```

A page that reads `searchParams` cannot be static. Honouring the URL literally
meant re-parsing, re-sanitising and re-highlighting every published article on
every single read, forever, to support a feature used a handful of times a month
— against NFR-1, and a standing cost on the runtime this deploys to.

So the preview lives at `/blog/{slug}/preview?token={token}` and `/blog/[slug]`
is prerendered again. **AC US-3.3's URL shape is not met as written**; everything
else it asks for is: a signed, time-limited token, a visible "Draft preview"
banner, `noindex`, uncached, and 404 for expired, tampered, absent, or
minted-for-another-post.

### 13.3 The view counter is an image

An `<img>` request, not a script. The article page ships no JavaScript by design,
and a beacon would have broken that as well as missing every reader with
scripting off and every cached page — which between them are most of the reads
worth counting.

It is decorative and best-effort, exactly as the threat model already says:
trivially inflatable by anyone willing to reload, never used for ranking or
billing. Deduplicating would mean identifying readers, which is a far worse trade
than an imprecise number.

The code-copy buttons are the one thing on an article that needs a script, and
they are attached after the page has rendered — so with JavaScript off there are
no dead controls, just an article without copy buttons.

### 13.4 Verification performed

- `npm run check` clean; builds with everything configured and with nothing
  configured.
- `npm run test:e2e` — **55 passing**, up from 48: seven new authoring specs.
- Preview tokens exercised through the real admin control, not a harness: valid,
  expired, tampered, and minted-for-another-post, all four in a fresh browser
  context with no session.
- `/blog/[slug]` confirmed prerendered again after the route split.
- The view counter confirmed to increment, and the pixel to be a 42-byte GIF
  with `no-store`.

### 13.5 What is left

Phase 5 is the growth work: Postgres full-text search, then `pgvector` semantic
search, Giscus comments, series support. Before any of that, the outstanding
items from §11.6 and §12.6 are the higher-value ones — a CSP (now unblocked,
since `proxy.ts` exists), Vitest for the pure logic, and axe in the committed
suite.

---

## 14. Review round — phases 3 and 4

Reviewed the same way phases 0–2 were: a security pass and a conventions pass
against the threat model and the existing code, plus axe, `npm audit` and a
per-route bundle audit. Twenty-two findings acted on. The two that matter most
were not in either report — one came out of writing a test, the other out of
running one.

### 14.1 The account-linking hole

**The allow-list could be walked around entirely, and the code that was supposed
to stop it never ran.**

Better Auth links an incoming OAuth account to an existing user row **matched by
verified email**, and that path calls `linkAccount` + `createSession` directly —
never `createUser`. So `databaseHooks.user.create.before`, which is where the
allow-list lives, was never reached. `requireAuthor()` then read `githubId` off
the _stored row_, which is the author's, not the identity that had just
authenticated.

Anyone who could get GitHub to verify the author's email address on an account of
their own would have signed in as the author, past a hook that never fired and a
check looking at the wrong record. The email is in this repository's own commit
metadata.

`account: { accountLinking: { enabled: false } }`. One line, and the property
T-1 claims — identity pinned to an immutable numeric id — is now actually true,
because there is only one path to a session and the hook is on it.

### 14.2 Sign-out looked like it worked

`authClient.signOut()` returns `{ error }` rather than throwing, and the button
ignored it and redirected to the login page regardless. Someone told they had
signed out while their session stayed live on the server is the worst possible
shape for that bug: the failure is invisible precisely when it matters.

Found by writing the test, not by reading the code. The button now reports the
failure and stays put. The suite gives the test server a `BETTER_AUTH_URL` that
matches its own origin, because Better Auth checks the request `Origin` before it
will sign anyone out — with the wrong value it answers 403 and the session
survives, which is a real failure worth catching rather than a quirk to configure
around.

### 14.3 The rest, by severity

| #   | Finding                                                                                                     | Fix                                                                                                                                                                                                                                                       |
| :-- | :---------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H   | OAuth account linking bypassed the allow-list                                                               | §14.1                                                                                                                                                                                                                                                     |
| H   | Sign-out failure silently ignored                                                                           | §14.2                                                                                                                                                                                                                                                     |
| M   | Preview tokens were sent to PostHog in `$current_url` — a live bearer credential to a third party, retained | `before_send` redacts any property whose value is a URL carrying `token`. The first attempt listed property names and still leaked via `$session_entry_url`; checking the value is a property that stays true, checking the key is a list that goes stale |
| M   | The view counter incremented drafts, and its comment claimed it did not                                     | `isPublic` filter added, slug length bounded, comment rewritten to describe the code                                                                                                                                                                      |
| M   | A half-configured deployment answered 500 rather than behaving as if it had no admin                        | `create()` checks `isAuthConfigured()` up front, so `requiredEnv` is unreachable by construction                                                                                                                                                          |
| M   | The presigned URL constrains neither size nor content type — `aws4fetch` treats both headers as unsignable  | Cannot be fixed in the app; the comment claiming otherwise was replaced with what the control actually is, and R2 bucket policy named as where the rest belongs                                                                                           |
| M   | A malformed post id reached a `uuid` column and raised 22P02, so `/admin/edit/anything` was a 500           | `postIdSchema` parsed in every action and admin read; a bad id is now "no such post"                                                                                                                                                                      |
| L   | The absolute session cap **failed open** on an unparseable `createdAt`                                      | Inverted: a guard that cannot evaluate its input denies                                                                                                                                                                                                   |
| L   | `e2e/support/session.ts` would provision a real admin identity against any database it was pointed at       | Loopback-only assertion, throwing                                                                                                                                                                                                                         |
| L   | Better Auth's rate limiter defaulted to per-isolate memory, which on Workers resets constantly              | `storage: "database"`, with the table it needs                                                                                                                                                                                                            |
| L   | No CSP                                                                                                      | Added — see §14.4                                                                                                                                                                                                                                         |
| L   | Upload refused an unauthenticated caller with a 500                                                         | 401, like every other refusal in that handler                                                                                                                                                                                                             |
| Q   | Form errors were announced but never associated with their fields                                           | `aria-invalid` + `aria-describedby` on every input                                                                                                                                                                                                        |
| Q   | `document` shadowed the DOM global for a whole client component                                             | Renamed                                                                                                                                                                                                                                                   |
| Q   | The article card was written twice and the copies had already drifted                                       | One `ArticleCard`, used by the published page and the preview                                                                                                                                                                                             |
| Q   | The admin's tag fetch was a byte-for-byte copy of the public one                                            | Shared; the argument for separate _post_ queries does not extend to a helper that reads no post rows                                                                                                                                                      |
| Q   | Domain types declared in data files                                                                         | Moved to `features/blog/types.ts`                                                                                                                                                                                                                         |
| Q   | Dead code: a prop never destructured, two fields written and never read, an unused export                   | Removed                                                                                                                                                                                                                                                   |
| Q   | No-op casts and a non-narrowing assertion                                                                   | Removed                                                                                                                                                                                                                                                   |
| Q   | Four comments describing something other than the code beneath them                                         | Rewritten or deleted                                                                                                                                                                                                                                      |
| Q   | `expect(links).toBeTruthy()` — a Locator is always truthy                                                   | Replaced with an assertion that can fail                                                                                                                                                                                                                  |
| Q   | The token-replay test used a hardcoded slug, so a renamed fixture would make it pass for the wrong reason   | Asserts the target is reachable first, and names the fixture in `constants.ts`                                                                                                                                                                            |

### 14.4 The CSP, and what it deliberately omits

`script-src` and `style-src` are **not** in it. Next inlines its own bootstrap and
RSC payload, and the theme script has to run before first paint, so any useful
`script-src` needs a per-request nonce — and a nonce cannot be baked into a
prerendered page. Adding one would turn every article dynamic, which is the same
trade already refused for the draft preview.

`default-src` is also absent, and that is load-bearing: it is the fallback for
`script-src`, so setting it to `'self'` blocks Next's inline bootstrap and the
site renders unstyled and unthemed. That was tried, caught in a browser, and is
now asserted against in the suite so nobody adds it back by reflex.

What is there needs no nonce and costs nothing: `frame-ancestors 'none'`,
`base-uri 'none'`, `object-src 'none'`, `form-action 'self'`, `img-src`,
`font-src`, `upgrade-insecure-requests`. Verified in a real browser across four
routes: the theme script runs, styles apply, zero violations.

### 14.5 Tests added

Twenty-six, in three files:

- **`e2e/accessibility.spec.ts`** — axe across six routes in **both themes**,
  failing on `serious` or `critical`. It had been run by hand for two phases; it
  had already caught four things nothing else did. Falsified before being trusted:
  a planted `<img>` with no alt is reported as `critical`.
- **`e2e/admin-session.spec.ts`** — the criteria under US-4.1 and US-4.2 that were
  unreachable until a session could be minted to be _wrong_ with: a real signed
  session for a non-allow-listed account is refused; one past its absolute age is
  refused and one inside it is not; sign-out destroys the row and the cookie
  cannot be replayed; upload limits hold for a signed-in caller.
- **`e2e/analytics.spec.ts`** — a draft preview token never reaches the tracker.

### 14.6 What is still open, and whose call it is

Nothing here is a code decision left hanging; all of it needs something that does
not exist yet.

- **Nothing is deployed.** The Cloudflare adapter is wired and inert.
  `npm run preview` has never run: `workerd`'s install script is blocked by this
  machine's npm settings (`npm install-scripts approve workerd`).
- **No Neon project, no GitHub OAuth app, no R2 bucket.** Until the OAuth app
  exists the GitHub round trip is untested — deliberately, since the alternative
  is a mock proving a mock behaves like a mock. Until the bucket exists the upload
  happy path is untested; the refusal path is covered.
- **Vitest is still not introduced.** The pure logic worth unit-testing has grown:
  preview-token signing and verification, slug collision, reading time, the
  content pipeline, the Zod schemas. All are currently covered only indirectly.
- **Dependabot is not configured** (T-13). It opens pull requests against the
  repository, which is the owner's call rather than a code change.
- **`session.created_at` has no timezone**, because Better Auth generates that
  schema. Exact on a UTC runtime, which Workers is; off by the local offset
  anywhere else, against a 30-day window.

### 14.7 Two the review missed, found by running things

**`safely()` was swallowing Next's control flow.** It wraps every public read and
turned any thrown error into the empty result - including
`DYNAMIC_SERVER_USAGE`, which is how Next says "this route uses a dynamic API,
render it dynamically", and the `NEXT_` signals behind `redirect()` and
`notFound()`. Eating those does not degrade gracefully; it discards an
instruction and the render fails further on with the cause thrown away. Tag pages
answered 500 with a masked digest. `safely()` now rethrows anything carrying a
framework digest and catches only real failures.

**A hung database blocked the build rather than degrading.** `safely()` caught
errors, and a stalled connection is not an error - it is silence. Observed when
the local container wedged: the sitemap did not fail, it stalled until the build
gave up after three attempts. Reads are now bounded by a timeout, so the promise
the wrapper makes is true for the failure mode that actually happens.

Both are the same lesson from opposite ends: a catch-all has to be deliberate
about what it catches, and a wrapper that promises resilience has to cover the
way things really break.

### 14.8 One more, found by re-auditing

`npm audit --omit=dev` was clean before phase 3 and is the check that caught this:
**`better-auth` declares `drizzle-kit` as a runtime dependency**, not a peer or a
dev one, which pulled `@esbuild-kit/esm-loader` and a vulnerable `esbuild`
(GHSA-67mh-4wv8-2f99) into the _production_ tree. The advisory is a dev-server
issue that cannot occur here - nothing on that path runs in a request - but it was
in the tree, and a scanner would rightly flag it.

Fixed with an `overrides` entry pinning `esbuild`. Both audits are now zero, and
`db:generate`, `db:migrate`, `db:seed` and `next build` were re-run to prove
nothing depended on the version it replaced. The clean fix is upstream.

## 15. Production readiness — branch `chore/production-readiness`

Everything in §14.6 that was left open as "worth doing, not worth blocking a
phase on", plus the two items the review deferred to the repository owner. Not a
feature branch: nothing here changes what the site does, only what can be known
about it when it misbehaves and what it refuses to do when attacked.

### 15.1 Unit tests, for the things a browser cannot reach

Vitest, 76 tests across six files. The end-to-end suite proves the system works
in place; it cannot cheaply prove the boundaries of a pure function. So these
cover exactly what Playwright is bad at:

- **`preview-token`** — the expiry boundary in both directions, a signature
  altered by one character, a payload re-encoded with a longer life and the old
  signature attached, and eight shapes of malformed input that must all collapse
  to the same `false`. This is the only thing between an unpublished draft and
  anyone holding a URL (T-4).
- **`content`** — the render pipeline, and mostly the sanitiser: a `javascript:`
  image source the renderer will happily emit, a `javascript:` href, an `http:`
  image, the inline styles Tiptap stores on tables, and the `rel` an anchor gets
  whatever the stored document asked for (T-2). Plus the heading-shift property
  that five silent bugs in phase 2 came out of.
- **`slug`, `reading-time`, `media`, `validators/blog`** — the ordinary edges.

`vitest.config.mts` aliases `server-only` to an empty stub, because the modules
under test import it and Vitest is not a server. `test/support/server-only.ts`
says so in a comment, so the next person does not go looking for the real one.

`npm run check` now runs them, so they are on the same gate as the linter.

### 15.2 Correlation ids: `lib/observability.ts` and `instrumentation.ts`

PRD US-6.2 asks that a server error be findable from what the reader was shown,
and that the reader be shown nothing more than that.

Next already supplies the identifier — it hashes every server error into a
`digest`, renders that on `app/error.tsx`, and withholds the message and the
stack. So the digest _is_ the correlation id, and inventing a second one would
produce a request id the reader never sees and could never quote. `logServerError`
emits one JSON line keyed on it; `onRequestError` in `instrumentation.ts` catches
what never reaches a `try`.

Deliberately **not** logged: the request headers. They carry the session cookie.

### 15.3 The consent gate

The tier-1 spec recorded this as the one open item that made the site
non-compliant rather than merely imperfect: PostHog sets first-party cookies, and
for a `.uk` site PECR wants consent _before_ they are set.

The tracker now does not initialise at all until the answer is yes — not
initialised-then-opted-out, never started, so nothing is written and nothing is
sent. Declining and ignoring produce the same state. Refusing is the same size
and prominence as accepting. It can be withdrawn from the footer of every page,
which stops the tracker and clears what it stored.

The decision itself lives in `localStorage` rather than a cookie, so the site
sets **no cookies at all** before consent — a simpler thing to be sure of than an
exemption argument about a strictly-necessary one.

#### The defect the gate introduced, found by running it

The banner is `fixed inset-x-0 bottom-0`. The resume download — the site's main
call to action — is in the footer, at the bottom of the page. So the notice
landed directly on top of it, and the button was **unclickable for exactly as
long as the question went unanswered**: a first-time visitor could not download
the CV without first dismissing a cookie bar. The control for withdrawing consent
sits in the same footer, so that was covered too.

Two Playwright tests failed on it and the accessibility snapshot is what gave it
away — the button appeared in the tree without the `[active]` marker the other
runs had, meaning the click never landed rather than the download being slow.

Fixed by having the banner also render an in-flow spacer of its own measured
height, so the page grows by exactly what the fixed bar covers. Measured with a
`ResizeObserver` rather than hard-coded, because the text wraps to two and three
lines as the viewport narrows. `e2e/analytics.spec.ts` now asks the browser which
element is on top at the middle of the button, and then downloads the file to
prove it is clickable and not merely uncovered. Falsified by zeroing the spacer:
the test fails.

#### And one in the test harness

`recordAnalytics(page, { consent: null })` cleared the stored decision in an
init script — which runs on **every** document, so a test that declined and then
reloaded to check the answer had stuck was wiping the answer on the way. It now
only ever seeds a value; `null` is the empty storage a fresh context already has.

### 15.4 Content-Security-Policy: what was added, and why `script-src` still is not

Added, all of them free: `connect-src`, `style-src`, `frame-src`, `media-src`,
`worker-src`, `manifest-src`. Without a `script-src`, `connect-src` is the
directive doing the real work against T-2 — an injected script still runs, but
this origin and the analytics endpoint are the only places it can send what it
read.

Its host comes from `lib/analytics-host.ts`, which exists solely so the policy
and the tracker cannot drift. A policy naming a different host blocks every event
and looks like an outage rather than a typo, so `e2e/blog.spec.ts` asserts the
two agree.

**`script-src` is still absent, and this was measured rather than assumed.** A
useful one needs a per-request nonce: Next inlines its own bootstrap and the RSC
payload, and hashing cannot substitute because that payload differs per page and
per build. A nonce must come from middleware, and a nonce cannot be baked into a
prerendered page — the HTML then holds a per-request value, so Next renders on
every request instead of serving a file.

Ten routes are prerendered today. An article body costs **~430ms of CPU on a cold
isolate** (Shiki loading its grammars and both themes) and ~40ms warm, against
zero now, because now it is a static file. On a per-request-billed runtime that
converts the site's most linkable URLs into paid compute anyone can invoke in a
loop — **T-11, denial of wallet, made materially worse** in exchange for
defence-in-depth behind a sanitiser that is itself the control for T-2 and now
has unit tests standing over it.

That is a trade worth taking only with the render cached per-URL behind the
nonce, or on a runtime where the billing reads differently. Recorded here so the
absence is a decision with a number attached rather than an oversight.

### 15.5 Dependabot, and the CI it needs to be worth anything

`.github/dependabot.yml`, weekly, npm and GitHub Actions, minor and patch grouped
into one pull request so majors stay separate and get read. Security updates need
no schedule — GitHub raises those as soon as an advisory matches the lockfile.

This session alone saw three advisories land in transitive dependencies nothing
here imports directly: `esbuild` through `drizzle-kit` (§14.8), then `sharp` and
`js-yaml`. Each was caught by running `npm audit` at the right moment, which is
luck, not a control.

A bot that raises bumps nobody can verify is worse than no bot, and this
repository had no CI at all — so `.github/workflows/ci.yml` runs the same
`npm run check` plus a build on every pull request. It deliberately does not run
Playwright: that needs Postgres, the Neon proxy, a production build and a browser
download, and holding a dependency bump behind minutes of that is the wrong
trade. `npm audit` reports there rather than blocks, because advisories appear
between commits rather than because of them.

The build runs with **no `DATABASE_URL`** on purpose. Every read degrades to an
empty result rather than throwing, so the site builds without one — asserting it
in CI keeps that true, and it is also what a fresh clone gets.

### 15.6 What the first full run of the logger showed

The logger was written, and then the end-to-end suite was run against a real
database with it watching. Five of the six error lines it produced were the same
thing: `The destination stream closed early.`, from `render:/blog/tag/[tag]`.

Next prefetches a link's RSC payload on hover and cancels it the moment the
pointer moves on. The render is already in flight, so it finishes into a socket
nobody is holding and throws. Nothing is wrong - the page was served, or was
never wanted. But five in one scripted run means a real tag list produces them
steadily, and at `error` they bury the failures the digest exists to make
findable. Any alert keyed on the level would fire constantly and then be muted,
which is the worst of both.

They are now recorded at `info`, on the info stream, without a stack. Demoted
rather than dropped: a flood of them is itself a signal.

Matched on message, because Next throws a plain `Error` with no code or name to
check - so `observability.test.ts` asserts both directions, including that
"The upload was aborted by the storage backend" stays an error. A loose match
would silently reclassify real failures as noise, which is worse than the noise.

Worth recording as a method rather than a fix: the logger earned its place by
being run, not by being reviewed. The same is true of every bug in §11 and §14.7.

### 15.7 A click that never happened

One CV-download test failed at 90s against a 6s operation, and the accessibility
snapshot again said why: the button carried focus from the click but was still in
its resting state, so the handler had never run.

The resume page is server-rendered, so every control is present, focusable and
clickable well before it does anything. Playwright's actionability checks are
satisfied by that markup - visible, stable, enabled, uncovered - and it will
happily click a button whose `onClick` does not exist yet. The click is then
silently lost: no error, no state change, and a `waitForEvent` that sits there
until the test gives up. It only appears under load, which is the worst way for
it to appear, because it reads as flakiness rather than as a race.

`whenHydrated()` waits for the consent UI, which is the one thing on the page
that _cannot_ be server-rendered: the decision lives in `localStorage`, so both
`ConsentBanner` and `ConsentControl` return `null` until an effect has run.
Exactly one of them is on the page once it has. Waiting for either proves the
effect fired, which proves hydration.

Verified by repetition rather than by one green run - the four download tests,
twice each, on the loaded machine that produced the failure.

### 15.8 Still open

- **The nonce**, per §15.4 — a decision, not an oversight.
- **`session.created_at` has no timezone**, still, because Better Auth generates
  that schema (§14.6).
- **Playwright in CI**, which is what would make a Dependabot bump fully
  verifiable rather than mostly.
