# Blog — Implementation Plan

Status: Phases 0–2 reviewed and pushed; Phases 3–4 implemented, awaiting review
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
