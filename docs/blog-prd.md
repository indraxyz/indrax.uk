# indrax.uk Blog — PRD, User Stories & Hardening

> **Repository copy.** This is the source requirements document for the blog
> feature, committed so the acceptance criteria live beside the code that has to
> satisfy them. It describes the feature whole, across all seven phases. What is
> actually built on any given branch, and where reality has diverged from this
> document, is tracked in [`blog-implementation-plan.md`](./blog-implementation-plan.md).

Companion to `blog-spec-v2.md`. That document says _how to build it_. This one defines _what "done" means_ and _what "hardened" means_, in terms an agent or a test can verify.

---

## 0. Scope discipline

**Actors:** Reader (anonymous public), Author (you, exactly one), Crawler (search engines, feed readers).

**Explicitly out of scope for v1** — listed so an agent does not invent them:

- Multi-author, roles, permissions beyond one allow-listed identity
- Public user accounts, likes, bookmarks
- Comments (Phase 5, via Giscus — no DB tables)
- Email newsletter
- Scheduled/timed publishing (publish is manual)
- i18n / translated posts
- Media library UI (uploads attach to a post, no browse-all view)

**Non-goals:** this is not a CMS product. Every feature must justify itself against "does this help me publish an article or help someone read it."

---

## 1. Non-functional requirements

These are global. Every story inherits them; a story is not done if it breaks one.

| ID     | Requirement                                                                             | Verification                      |
| ------ | --------------------------------------------------------------------------------------- | --------------------------------- |
| NFR-1  | LCP < 2.5s, INP < 200ms, CLS < 0.1 on `/blog` and `/blog/[slug]`, mobile throttled      | Lighthouse CI                     |
| NFR-2  | Lighthouse SEO ≥ 95, Accessibility ≥ 95                                                 | Lighthouse CI                     |
| NFR-3  | Zero axe-core violations at `serious` or `critical`                                     | `@axe-core/playwright`            |
| NFR-4  | WCAG 2.2 AA — keyboard reachable, visible focus, 4.5:1 text contrast in **both** themes | Manual + axe                      |
| NFR-5  | No client-side JS shipped for article rendering or syntax highlighting                  | Bundle analysis                   |
| NFR-6  | Tiptap and admin code absent from any public route bundle                               | `npm run build` output inspection |
| NFR-7  | `npm run check` passes (format, lint, type-check)                                       | CI                                |
| NFR-8  | No `any` types introduced (existing codebase rule)                                      | `tsc --noEmit` + lint             |
| NFR-9  | Works with JS disabled for reading (article content is server-rendered)                 | Manual                            |
| NFR-10 | Dark and light themes both correct, no FOUC (existing theme script must keep working)   | Manual                            |
| NFR-11 | Print stylesheet does not regress on resume page                                        | Manual print preview              |

---

## 2. Epics & user stories

Format: **ID · Story · AC**. AC use Given/When/Then and are written to be executable.

---

### E1 — Read an article

#### US-1.1 · Read a published article

> As a Reader, I want to open an article by its URL so I can read it.

**AC**

- Given a post with `status='published'`, when I GET `/blog/{slug}`, then I receive 200 and the article title, body, publish date, tags, and reading time render.
- Given a post with `status='draft'`, when I GET `/blog/{slug}` unauthenticated, then I receive **404** (not 403 — do not confirm existence).
- Given a post with `status='archived'`, when I GET `/blog/{slug}`, then I receive 404.
- Given a slug that does not exist, when I GET it, then I receive 404 rendering the app's not-found UI.
- Given any article, when JS is disabled, then the full body text is still present in the HTML source.
- Given an article containing fenced code, when it renders, then code is syntax-highlighted server-side and no highlighting library appears in the client bundle.
- Given an article, when rendered, then exactly one `<h1>` exists and heading levels do not skip.

#### US-1.2 · Read comfortably on any device

> As a Reader, I want the article to be legible on my phone.

**AC**

- Given a viewport of 375px, when I view an article, then no horizontal scroll occurs and body text is ≥ 16px.
- Given body prose, when rendered, then measure is between 60 and 80 characters per line at desktop widths.
- Given the body font, when an article renders, then it uses `--font-prose`, while site chrome and code blocks remain JetBrains Mono.
- Given a code block wider than the viewport, when displayed, then it scrolls horizontally within its own container, is keyboard-focusable, and carries an accessible name.
- Given `prefers-reduced-motion: reduce`, when any transition would run, then it is suppressed.

#### US-1.3 · Trust what I'm reading

**AC**

- Given a published article, when rendered, then publish date is shown as a `<time datetime>` element.
- Given an article updated after publication, when rendered, then an updated date is shown distinctly from the publish date.

---

### E2 — Discover articles

#### US-2.1 · Browse all articles

**AC**

- Given published posts exist, when I GET `/blog`, then I see them ordered by `published_at` descending.
- Given more than `PAGE_SIZE` posts, when I view `/blog`, then pagination controls appear and page 2 is reachable at a crawlable URL (`<a href>`, not a JS-only control).
- Given zero published posts, when I GET `/blog`, then an empty state renders — not a crash, not a blank page.
- Given a list page, when it renders, then it queries excerpt-level columns only; `content` is not selected.
- Given a post card with a cover image, when it loads, then width and height are set and CLS contribution is 0.

#### US-2.2 · Filter by tag

**AC**

- Given a tag with published posts, when I GET `/blog/tag/{slug}`, then only posts carrying that tag appear.
- Given a tag with no published posts, when I GET it, then 404.
- Given a tag page, when rendered, then it declares a canonical URL and is not marked `noindex`.
- Given a draft post carrying a tag, when the tag page renders, then that post is absent.

#### US-2.3 · Find articles from the homepage

**AC**

- Given the resume homepage, when it renders and published posts exist, then a "Writing" section links to `/blog`.
- Given the homepage section, when rendered, then it reuses `SectionCard` and matches surrounding sections visually.
- Given zero published posts, when the homepage renders, then the section is omitted entirely rather than shown empty.

---

### E3 — Author an article

#### US-3.1 · Create a draft

**AC**

- Given I am authenticated, when I POST a valid new post, then it is persisted with `status='draft'` and `published_at` null.
- Given a title, when I create a post, then a URL-safe slug is generated; on collision a numeric suffix is appended and the result is unique.
- Given a manually edited slug, when saved, then it is validated against `^[a-z0-9]+(?:-[a-z0-9]+)*$` and rejected with a field-level message if invalid.
- Given invalid input (empty title, content over limit), when submitted, then the server rejects it via Zod, returns field errors, and writes nothing.
- Given a save, when it succeeds, then `reading_time` is computed and stored server-side (never trusted from the client).

#### US-3.2 · Edit an existing article

**AC**

- Given an existing post, when I open `/admin/edit/{id}`, then the form is populated with current values.
- Given an edit, when saved, then `updated_at` is set server-side and `created_at` is unchanged.
- Given an edit to a published post, when saved, then `published_at` does **not** change.
- Given a save, when it completes, then `revalidateTag('posts')` and `revalidateTag('post:{slug}')` both fire.
- Given a slug change on a published post, when saved, then I am warned that existing links will break.

#### US-3.3 · Preview before publishing

**AC**

- Given a draft, when I request a preview, then a signed, time-limited token is issued.
- Given a valid preview token, when I GET `/blog/{slug}?preview={token}`, then the draft renders with a visible "Draft preview" banner.
- Given an expired, tampered, or absent token, when I request a draft URL, then 404.
- Given a preview response, when returned, then it carries `X-Robots-Tag: noindex` and is not cached.

#### US-3.4 · Publish and unpublish

**AC**

- Given a draft, when I publish it, then `status='published'` and `published_at` is set to now if previously null.
- Given a published post, when I unpublish it, then it returns 404 publicly and disappears from `/blog`, tag pages, sitemap, and RSS within one revalidation cycle.
- Given a republish of a previously published post, when it happens, then the original `published_at` is preserved.
- Given a delete request, when issued, then it requires explicit confirmation and cascades to `post_tags`.

#### US-3.5 · Manage tags

**AC**

- Given a tag name, when I attach it, then a tag row is created if absent or reused if present — no duplicates by slug.
- Given tag input, when normalized, then it is case-insensitive and trimmed ("Next.js" and "next.js" resolve to one tag).
- Given a post, when I remove a tag, then only the join row is deleted; the tag itself survives for other posts.

#### US-3.6 · Add a cover image

**AC**

- Given an image under the size cap and of an allowed MIME type, when I upload it, then a presigned URL is issued and the file uploads directly to storage.
- Given a file exceeding the cap or of a disallowed type, when I attempt upload, then it is rejected **server-side** (client-side checks alone are insufficient).
- Given an uploaded cover, when saved, then alt text is required before the post can be published.
- Given a presigned URL, when issued, then it expires within 5 minutes and is scoped to a single object key.

---

### E4 — Access control

#### US-4.1 · Sign in

**AC**

- Given I am on the allow-list, when I complete GitHub OAuth, then a DB-backed session is created and I land on `/admin`.
- Given a GitHub account **not** on the allow-list, when OAuth completes, then sign-in is refused, no session row is created, and no user row persists.
- Given a successful sign-in, when the session is issued, then the cookie carries `httpOnly`, `secure`, `sameSite=strict`, and the token is rotated.
- Given a session, when it exceeds 7 days idle or 30 days absolute, then it is invalid.

#### US-4.2 · Keep the admin closed

**AC**

- Given no session, when I request any `/admin/*` route, then I am redirected to `/admin/login`.
- Given no session, when I invoke any mutating server action directly, then it fails authorization — **independently of middleware**.
- Given a session belonging to a non-allow-listed identity, when any action runs, then it is rejected.
- Given `robots.txt`, when fetched, then `/admin` is disallowed.
- Given any `/admin` route, when responded, then `X-Robots-Tag: noindex, nofollow` is set.
- Given I sign out, when the session is destroyed, then reusing the prior cookie fails.

---

### E5 — Distribution & SEO

#### US-5.1 · Be indexed correctly

**AC**

- Given any published article, when crawled, then it carries a unique title, meta description, canonical URL, OG tags, and Twitter card tags.
- Given an article, when crawled, then valid `Article` JSON-LD is present with `headline`, `datePublished`, `dateModified`, `author`, `image`.
- Given `Article` and `BreadcrumbList` JSON-LD, when validated by Google's Rich Results Test, then zero errors.
- Given `/sitemap.xml`, when fetched, then it contains the root URL, `/blog`, every published article with accurate `lastmod`, and every non-empty tag page — and **no** drafts.
- Given a draft, when the sitemap is generated, then its URL is absent.

#### US-5.2 · Subscribe via RSS

**AC**

- Given `/rss.xml`, when fetched, then it returns valid RSS 2.0 with `Content-Type: application/rss+xml` and validates against the W3C feed validator.
- Given the feed, when generated, then it contains only published posts, newest first, capped at a fixed item count.
- Given every page, when rendered, then `<link rel="alternate" type="application/rss+xml">` is present in `<head>`.
- Given feed items, when serialized, then URLs are absolute.

#### US-5.3 · Share well

**AC**

- Given an article, when shared, then a per-article OG image renders at 1200×630 using the site's brand tokens.
- Given a long title, when the OG image generates, then text wraps or truncates without overflow.
- Given OG image generation, when it fails, then a static fallback image is served rather than a broken response.

---

### E6 — Operations

#### US-6.1 · Recover from mistakes

**AC**

- Given a bad deploy, when I roll back, then the previous version serves without a database migration being required to roll back with it.
- Given every migration, when written, then it is additive or backwards-compatible for at least one release (expand/contract — no destructive column drops in the same release that stops using them).
- Given Neon, when configured, then point-in-time recovery is enabled and a restore has been tested at least once.

#### US-6.2 · Know when it breaks

**AC**

- Given a server error on any route, when it occurs, then it is logged with a correlation ID and does not leak a stack trace to the client.
- Given a database connection failure on `/blog`, when it happens, then a graceful error state renders — not an unhandled crash.
- Given the admin, when an action fails, then the failure reason is surfaced to me specifically enough to act on.

---

## 3. Threat model

Single-author blog, public read surface, one privileged account. Realistic risks, ordered by expected damage.

| #    | Threat                            | Vector                                                | Mitigation                                                                                                                                              | Verified by                                                                  |
| ---- | --------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| T-1  | **Admin account takeover**        | GitHub account compromise                             | OAuth + allow-list by immutable numeric ID (not username — usernames can be changed or reclaimed). Enable 2FA on the GitHub account itself.             | Manual: rename a test account, confirm the ID check still governs            |
| T-2  | **Stored XSS in article body**    | Tiptap/markdown output rendered as HTML               | `rehype-sanitize` with an explicit allow-list schema on render. Sanitize on **output**, not only on input — stored content may predate a schema change. | Test: store `<script>`, `<img onerror>`, `javascript:` href; assert stripped |
| T-3  | **Authorization bypass**          | Server action invoked directly, skipping middleware   | Session + allow-list re-checked inside every mutating action                                                                                            | Test: call action with no cookie, assert rejection                           |
| T-4  | **Draft leakage**                 | Guessable slug, sitemap, RSS, cache                   | Drafts 404 publicly; excluded from sitemap/RSS; preview requires signed token; preview responses `noindex` and uncached                                 | Test: draft slug returns 404; grep sitemap and feed                          |
| T-5  | **Storage abuse via upload**      | Presigned URL reused or oversized/malicious file      | Server-side MIME and size enforcement, short TTL, single-key scope, auth required to mint                                                               | Test: oversized file, disallowed type, expired URL                           |
| T-6  | **SSRF via remote image URL**     | Fetching a user-supplied URL server-side              | Do not fetch arbitrary URLs. Only own-storage hosts allowed in `next.config` `images.remotePatterns`                                                    | Config review                                                                |
| T-7  | **SQL injection**                 | Query construction                                    | Drizzle parameterizes; forbid raw string concatenation into `sql`                                                                                       | Code review + lint                                                           |
| T-8  | **Session fixation / theft**      | Cookie handling                                       | `httpOnly`, `secure`, `sameSite=strict`, rotate on login, DB-backed and revocable                                                                       | Manual inspection                                                            |
| T-9  | **CSRF on mutations**             | Cross-origin form post                                | Server actions carry built-in protection; `sameSite=strict` reinforces. Any hand-rolled route handler needs explicit origin checking.                   | Test: cross-origin POST                                                      |
| T-10 | **Secret exposure**               | Env var referenced client-side                        | Only `NEXT_PUBLIC_*` reaches the browser. `DATABASE_URL`, OAuth secret, `ALLOWED_GITHUB_ID` server-only.                                                | Grep built client bundle for secret fragments                                |
| T-11 | **Denial of wallet**              | Unthrottled hits waking Neon / burning storage egress | Cached public pages; rate limits on upload and auth; billing alerts                                                                                     | Load check                                                                   |
| T-12 | **CSP weakened by inline script** | `layout.tsx` injects an inline theme script           | If adding CSP, use a nonce or hash for that script — do not reach for `unsafe-inline`                                                                   | Header inspection                                                            |
| T-13 | **Dependency compromise**         | Supply chain                                          | Lockfile committed, Dependabot on, `npm audit` in CI                                                                                                    | CI                                                                           |

**Accepted risks (documented, not mitigated):** no WAF; no bot management beyond platform defaults; view counter is best-effort and trivially inflatable — it is decorative, never used for ranking or billing.

---

## 4. Hardening checklist

Run before first production deploy.

**Auth & access**

- [ ] Allow-list compares numeric GitHub ID, not username
- [ ] 2FA enabled on the GitHub account
- [ ] Every mutating action independently re-verifies session
- [ ] Sign-out invalidates the DB session row
- [ ] `/admin` disallowed in robots.txt and `noindex` via header

**Input & output**

- [ ] Zod validation on every server action, server-side
- [ ] `rehype-sanitize` applied at render with an explicit schema
- [ ] Slug regex enforced server-side
- [ ] Upload MIME and size enforced server-side
- [ ] `images.remotePatterns` restricted to own storage host

**Data**

- [ ] Migrations reversible or expand/contract
- [ ] Neon PITR enabled; one restore rehearsed
- [ ] Preview deploys use a Neon branch, never production
- [ ] No production credentials in any local or preview env file

**Transport & headers**

- [ ] HSTS
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`)
- [ ] CSP with nonce/hash covering the inline theme script

**Secrets**

- [ ] All secrets set via platform secret storage, not committed
- [ ] Built client bundle grepped for secret fragments
- [ ] `.dev.vars` gitignored if using Wrangler

**Quality gates**

- [ ] `npm run check` green
- [ ] Vitest unit suite green
- [ ] Playwright auth-boundary suite green
- [ ] axe: zero serious/critical
- [ ] Lighthouse: SEO ≥ 95, A11y ≥ 95, Perf within NFR-1
- [ ] Rich Results Test: zero errors
- [ ] W3C feed validator: valid

---

## 5. Definition of Ready / Done

**Ready** — a story may start when: AC are written and testable; schema impact known; design tokens identified (no new raw colours); security implications noted; out-of-scope boundaries stated.

**Done** — a story ships when: all AC pass; unit tests for pure logic; Playwright coverage for anything touching the auth boundary; `npm run check` green; both themes verified; keyboard path verified; no new axe violations; docs updated (`ARCHITECTURE.md` for structural change, `README.md` for new env vars); migration applied to a Neon preview branch first.

---

## 6. Phase → story map

| Phase                | Stories                    | Exit gate                                                                   |
| -------------------- | -------------------------- | --------------------------------------------------------------------------- |
| 0 — Runtime decision | —                          | Deploy target confirmed; `main` reconciled with deployed; deps repositioned |
| 1 — Data layer       | Schema for US-3.x          | Typed queries return seeded rows; migration runs on a Neon branch           |
| 2 — Public read      | US-1.1, 1.2, 1.3, 2.1, 2.2 | NFR-1..5, 9, 10 pass                                                        |
| 3 — SEO              | US-5.1, 5.2, 5.3           | Rich Results and feed validators clean; drafts absent from sitemap and RSS  |
| 4 — Auth             | US-4.1, 4.2                | T-1, T-3, T-8 tests pass                                                    |
| 5 — Authoring        | US-3.1..3.6                | T-2, T-5 tests pass; NFR-6 confirmed                                        |
| 6 — Homepage tie-in  | US-2.3                     | Resume page unregressed, print unaffected                                   |
| 7 — Ops              | US-6.1, 6.2                | Restore rehearsed; rollback rehearsed                                       |

Note the ordering: **auth lands before authoring**. Building the write UI first and bolting auth on afterwards is the standard way an admin panel ends up publicly reachable in an intermediate deploy.

---

## 7. Test matrix

| Layer       | Tool                   | Covers                                                                                                                                          |
| ----------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest                 | slug generation and collision, reading time, markdown pipeline including sanitization, Zod schemas, date formatting                             |
| Integration | Vitest + Neon branch   | queries, cascade deletes, tag dedupe, draft exclusion                                                                                           |
| E2E         | Playwright             | sign-in, allow-list rejection, `/admin` redirect when signed out, draft 404, preview token valid/expired, create→publish→visible, unpublish→404 |
| A11y        | `@axe-core/playwright` | `/blog`, `/blog/[slug]`, `/blog/tag/[tag]`, both themes                                                                                         |
| Perf        | Lighthouse CI          | NFR-1, NFR-2                                                                                                                                    |
| Security    | Manual + scripted      | The T-# table above                                                                                                                             |

**Minimum bar before launch:** every AC under E4 (access control) and T-1 through T-5 have automated coverage. Everything else can be manual initially — but not those.
