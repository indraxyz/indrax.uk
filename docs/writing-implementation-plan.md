# Writing — Implementation and Maintenance Plan

The writing feature is implemented on React Router **8.4.0** and Vite, with
public SSR, browser-loaded writing collections and a separately built static
admin CSR application. This plan records current boundaries and the order for
future changes rather than obsolete implementation history.

Related documents: [product requirements](writing-prd.md),
[technical specification](writing-spec.md), [architecture](../ARCHITECTURE.md),
[migration/setup guide](react-router-migration.md) and [testing](testing.md).

## Implemented scope

| Area             | Current implementation                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Content/data     | Neon HTTP + Drizzle, JSON documents, tags, publication lifecycle, full-text search, ordered series                     |
| Public reading   | SSR article bodies and metadata; sanitized HTML, table of contents, highlighting, related posts and view beacon        |
| Public discovery | CSR/API cards on home, archive, tags, search and series; RSS, sitemap and social cards                                 |
| Access           | Better Auth GitHub OAuth, immutable numeric allowlist, revocable DB sessions and private API guards                    |
| Authoring        | Lazy Tiptap editor, create/update, status changes, explicit delete confirmation, cover upload and signed draft preview |
| Cache            | Request memoization, revision-keyed KV/D1 public reads, rendered article cache and cached resource responses           |
| Navigation       | Retain current content with top progress bar during route preparation; centered spinner for initial data loads         |
| Operations       | Worker resource dispatch, generated binding/route types, Vitest, real SQL tests, Playwright and CI                     |

`app/routes.ts` and `routes/` define the public application;
`admin/routes.tsx` defines browser routing. `workers/app.ts` serves admin assets
without importing the public SSR tree. Feature components, the API handler in
`features/writing/api/server.ts` and existing query modules retain their distinct
responsibilities. Avoid building an alternative authorization, render or data
layer when extending a route.

## Change order and review gates

1. **Confirm the contract.** Describe the user-visible trigger/outcome in the PRD
   or issue, rendering policy, API payload and authorization requirements. Keep
   public content published-only; identify changes that affect caches or SEO.
2. **Change schema and data operations first.** Use Drizzle migrations and an
   isolated database. Preserve compatibility with the preceding deployed release.
   Keep summary projections small; batch paired reads and atomic post/tag writes.
   Check constraints, publication timestamps, tag reuse, series ordering and
   rollback before wiring a UI.
3. **Implement the backend boundary.** Reuse the author guard, bounded request
   reader, shared Zod schemas and safe errors. Validate request origin for
   mutations. Private/signed responses must remain uncached and non-indexable;
   signed preview verification precedes database access.
4. **Expose the typed client contract.** Extend `features/writing/api/client.ts`
   and feature types together. Reuse Ky and TanStack Query keys; never retry a
   mutation automatically. Define targeted invalidation and loading/error states.
5. **Compose route and feature UI.** Use React Router loaders/client loaders to
   prepare navigation, existing UI primitives and design tokens. Keep editor,
   auth and PDF dependencies lazy. Preserve current content during navigation and
   avoid full-screen loading flashes on background refreshes.
6. **Verify rendering and cache behavior.** Article metadata and HTML must exist
   before browser JavaScript. Home/archive cards remain API-driven. Sanitize on
   output, preserve one article `h1`, and bump the rendered-article cache version
   after sanitizer/renderer policy changes. Await public revision invalidation
   after mutations so unpublishing cannot reveal a stale public article.
7. **Complete checks and documentation.** Follow [testing](testing.md), run
   `npm run check` and `npm run build`, inspect affected public/admin bundles,
   and update architecture/setup docs when contracts or configuration change.
   Keep the PR reviewable with a concrete outcome, validation and limitations.

## Regression coverage

| Layer                | Cases to preserve                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit/API boundary    | Slugs, document validation/sanitization, reading time, bounded input, publication rules, preview signatures, author checks, same-origin rejection and cache invalidation |
| Real SQL integration | Minimal projections/query counts, transaction rollback, tag dedupe, draft isolation, ordered-series constraints and cascades                                             |
| Browser public       | Article HTML/metadata, safe rich content, archive/tag/search/series navigation, empty/error states, responsive UI and keyboard access                                    |
| Browser admin        | Session freshness/revocation, allowlist enforcement, authoring CRUD, failure feedback, signed previews and denied private reads                                          |
| Shared UX            | Initial centered spinner, top progress bar during delayed navigation, retained current content, theme/print behavior, consent-safe analytics and lazy PDF/auth loading   |
| Deployment profiling | Cold/warm CPU and wall time, API/database spans, cache hit/miss paths and bundle limits                                                                                  |

Use browser fixtures with deterministic API interception when testing UI states;
use real local database/session fixtures for access and mutation boundaries.
Live GitHub OAuth and actual R2 PUT behavior need a configured environment.
Do not replace those checks with mocked success claims.

## Known operational limits and follow-ups

- Public SSR and first-time content highlighting can exceed a very small CPU
  budget even after API/CSR separation. Measure deployed invocation CPU time;
  waiting for Neon/network responses mainly affects wall time.
- KV propagation and simultaneous misses can cause repeated rendering. D1
  revisions prevent stale cache keys from silently bypassing invalidation but
  are not a distributed render lock.
- R2 presigned requests validate reported MIME/size and scope a short-lived
  credential to one object. They do not enforce the bytes ultimately uploaded;
  additional stored-object enforcement remains a deployment concern.
- CSP has no `script-src` directive. A stricter nonce/hash policy must account
  for the inline theme script and streaming SSR bootstrap before enabling it.
  Do not carry forward assumptions about a different rendering runtime.
- Auth rate limits are shared through the database. Broader upload/traffic
  limits, billing alerts, database restore and rollback drills must be checked
  in the target environment.
- Search and series are implemented. Semantic search, comments and other growth
  features require their own scoped requirements and security review.

## Completion criteria for a change

Affected product requirements are verified; the author boundary remains enforced
inside backend/data operations; drafts stay out of public reads, caches and
resources. Formatting, lint, generated types, TypeScript and relevant automated
tests pass. Both themes and keyboard paths work. Documentation uses current file
paths, scripts and APIs. Production claims are supported by deployment evidence,
not old local timing snapshots. Commit/push/PR and deployment follow the user's
review and release instructions.
