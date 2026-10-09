# Writing — Current Technical Specification

The writing feature uses React Router **8.4.0**, Vite, React, Tailwind CSS,
TanStack Query and Ky on Cloudflare Workers. Product stories and acceptance
criteria live in [the writing PRD](writing-prd.md); this document describes the
current implementation. See [architecture](../ARCHITECTURE.md),
[the migration guide](react-router-migration.md),
[the implementation plan](writing-implementation-plan.md) and
[testing](testing.md) for setup and verification.

## Rendering and route boundaries

| Surface                                                                      | Rendering and data                                                                |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `/`, `/resume`, `/tech-stack`                                                | Public SSR for profile content and metadata                                       |
| Home recent-writing section                                                  | Browser query of published summaries                                              |
| `/writing`, `/writing/tags/:tag`, `/writing/search`, `/writing/series/:slug` | Public shell with browser-loaded cards, filters and pagination                    |
| `/writing/:slug`                                                             | SSR of the full published article, metadata and structured data                   |
| `/writing/:slug/preview`                                                     | Browser-rendered signed preview; backend verifies the token and sanitizes content |
| `/admin/*`                                                                   | Separate static CSR application with browser routing                              |
| RSS, sitemap, robots, social images                                          | Worker resource responses                                                         |

`app/routes.ts` declares public routes. Modules under `routes/` compose feature
components and export React Router loaders and metadata. `admin/routes.tsx`
defines the independent admin application. `workers/app.ts` dispatches assets,
APIs, resources and SSR before loading their implementations.

Client loaders prepare destination data through the shared QueryClient before a
navigation commits. Public and admin navigation show a design-token green top
progress bar and retain the current page while waiting. Initial/hard loads show a
centered spinner; background refreshes retain content without restarting the bar.

CSR moves list/editor rendering to the browser. Authentication, validation,
mutations and article sanitization remain server responsibilities; this design
does not guarantee a deployed Worker CPU ceiling.

## Feature modules and data model

- `features/writing/config.ts`: route names, shared copy and bounded page/search/feed sizes.
- `features/writing/types.ts`: document, summary, article and API contracts.
- `features/writing/data/`: published queries, protected admin reads/mutations and rendered-article caching.
- `features/writing/api/`: typed browser client and backend endpoint handling.
- `features/writing/components/`: cards, article chrome, search/series navigation and admin authoring UI.
- `features/writing/editor/`: shared Tiptap document extensions.
- `features/writing/utils/`: slug normalization, plain text, reading time, sanitized rendering, preview tokens and structured data.
- `lib/db/schema.ts` and `drizzle/`: Drizzle schema and versioned migrations.

Neon Postgres is the content source of truth, accessed with the Neon HTTP driver
and Drizzle. Posts store a Tiptap/ProseMirror JSON document in `content_json`, not
Markdown source. They include a unique slug, title, excerpt, optional cover/alt,
status (`draft`, `published`, `archived`), publication and update timestamps,
reading time, decorative view count and optional ordered series membership.
Tags are shared rows joined through `post_tags`; deleting a post cascades its
joins. Series positions are unique within a series.

The generated full-text search vector indexes title, excerpt and document text
nodes rather than node names, link URLs or code-language attributes. Search uses
Postgres full-text queries and a GIN index. Series readers see only parts they
can open publicly, sorted by part number.

List queries project summaries without bodies and aggregate tags in SQL. Paired
count/page queries and post/tag writes use the existing Neon HTTP batch API;
failed writes roll back the batch. Series metadata resolution is a separate
operation and must not be described as part of that atomic batch.

## Browser API contracts

`features/writing/api/client.ts` wraps the same-origin Ky client. TanStack Query
owns list/search/session state, stale data and targeted mutation invalidation.
Default queries have a one-minute stale time, no automatic retries and no focus
refetch; session checks require fresh authorization state. Mutations are not
retried. Loading, empty, not-found and failure states remain distinct.

| Endpoints                                                                | Access                                                |
| ------------------------------------------------------------------------ | ----------------------------------------------------- |
| `GET /api/writing/posts`, `/recent`, `/tags`, `/search`, `/series/:slug` | Published-only data                                   |
| `GET /api/writing/preview/:slug?token=...`                               | Valid, expiring signature for that exact slug         |
| `GET /api/admin/session`                                                 | Session/configuration state; anonymous author is null |
| `GET /api/admin/overview`, `/posts`, `/posts/:id`                        | Authorized author                                     |
| `POST /api/admin/posts`                                                  | Authorized, same-origin validated create/update       |
| `PATCH /api/admin/posts/:id/status`                                      | Authorized, same-origin status change                 |
| `DELETE /api/admin/posts/:id`                                            | Authorized, same-origin deletion                      |
| `POST /api/admin/posts/:id/preview`                                      | Authorized, same-origin preview link                  |
| `POST /api/upload`                                                       | Authorized, validated R2 upload authorization         |

The complete prefix applies to grouped endpoint suffixes above. API response
contracts are defined in feature types; SQL and authorization are not duplicated
in route components. Private responses use `no-store` and safe structured errors.

## Authoring and access control

GitHub OAuth through Better Auth admits one immutable numeric GitHub ID.
Implicit account linking is disabled so email matching cannot bypass the
allowlist. Sessions are DB-backed and revocable, with seven-day idle expiry and
an independently enforced thirty-day absolute lifetime. Production uses secure
cookies. Every private API and protected data operation verifies the real session
and allowlist; a navigation redirect or cookie-presence check grants no authority.

Zod validates IDs, slugs, statuses, covers, tags and series input. The server
computes reading time, derived excerpts and timestamps. Editing or republishing
preserves the original publication date. Delete requires explicit UI confirmation.
Save/status/delete invalidate affected admin/public query keys and public cache
revisions. A changed published slug can break existing links and must remain a
visible authoring concern.

Mutation request bodies are streamed with a 512 KiB ceiling before JSON parsing,
including requests without Content-Length. The document limit and structural
checks apply independently; client checks never replace server checks. Search,
page numbers and limits are bounded before reaching SQL or persistent cache keys.

The editor is lazy-loaded only in admin authoring routes. The Better Auth browser
client is loaded when a sign-in/sign-out action needs it. Server secrets and
server-only dependencies must never enter either browser build.

## Article rendering, discovery and design

The server renders the shared Tiptap extensions to HTML, applies an explicit
sanitizer policy, normalizes headings and produces a table of contents. The article
title is its single `h1`. External links and media obey shared URL policies;
arbitrary image URLs are not fetched by the article renderer. Syntax highlighting
loads only when code blocks require it and uses the configured language bundle.
Copy-code controls enhance the already readable SSR article.

Published articles expose title, description, canonical, Open Graph/Twitter
metadata, `Article` and `BreadcrumbList` JSON-LD, dates and reading time. RSS and
sitemap contain published content only. Public detail reads return 404 for drafts,
future publication and missing content. Signed draft previews are uncached and
excluded from indexing. The view beacon is best-effort decoration, not a reliable
analytics or ranking measure.

Writing UI composes existing `SectionCard`, cards, badges, variants, date helpers
and `cn`. Tailwind configuration is CSS-first in `app/globals.css`. Reuse the
primitive → semantic → component token pipeline in both themes; article prose
uses the existing prose font/tokens and monospace code styling. Preserve keyboard,
screen-reader, responsive and print behavior.

## Cache and operations

Public reads are memoized per request. Persistent KV keys incorporate D1 tag
revisions from the existing `revalidations` table and expire after one hour.
Mutations await invalidation and clear request-local revision state. Rendered
articles include post identity, saved revision and renderer version in their keys;
renderer policy changes require a version bump. Private reads and draft rendering
never persist in public caches. Revision keys reduce stale KV reuse; distributed
misses can still repeat expensive work.

`lib/security-headers.ts` centralizes CSP, HSTS, framing and MIME protections.
Admin responses carry `noindex, nofollow`; robots excludes admin/API paths.
Same-origin mutation checks supplement cookie protections. Logged server failures
include correlation context and do not expose stack traces to visitors.

R2 authorization permits JPEG, PNG, WebP and AVIF up to a reported 5 MiB, with a
five-minute PUT URL for a server-generated single object key. The presigned URL
itself does **not** cryptographically enforce the uploaded body size or MIME type;
actual stored-object enforcement requires an additional storage/upload control.
Do not claim the author-only request validation closes that gap. Auth rate limits
use shared DB storage; broader upload/traffic controls require deployment review.

Runtime secrets and safe public configuration are documented in
[README](../README.md) and environment templates. Use existing Wrangler bindings,
Drizzle migration commands and isolated preview databases. Schema changes should
follow expand/contract and be verified before production. Restore/rollback drills,
R2 policy verification and production CPU measurements are operational checks,
not automatically proven by a successful local build. Semantic search and public
comments are not implemented requirements of this feature.

## Verification

Use the commands and fixtures in [testing](testing.md). `npm run check` covers
formatting, lint, generated types, TypeScript and unit tests. Real SQL integration
tests cover batching, query counts, isolation and rollback. Playwright covers
public discovery, sanitized rendering, authoring, access boundaries, preview,
search/series, navigation feedback and accessibility against the built Worker.
Run `npm run build` and inspect both public/admin output for accidental server
imports, stale assets and bundle growth. Profile deployed cold and warm CPU time
separately from wall time before claiming free-tier compliance.
