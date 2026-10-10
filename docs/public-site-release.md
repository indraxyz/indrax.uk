# Public writing: pagination, release preparation, and optimization

## Context

Reviewed develop-targeted PRs on 2026-10-09. The main implementation context is:

- [#48](https://github.com/indraxyz/indrax.uk/pull/48): isolate deployment targets;
  GitHub Actions owns deployment and Workers dashboard Git Builds stays disconnected.
- [#52](https://github.com/indraxyz/indrax.uk/pull/52): reduce Worker CPU and
  speculative navigation requests; introduce isolated KV/D1 revision caching.
- [#53](https://github.com/indraxyz/indrax.uk/pull/53): batch Neon reads and writes,
  reduce projections, and verify SQL request budgets and atomicity.
- [#54](https://github.com/indraxyz/indrax.uk/pull/54): React Router public SSR,
  independent CSR admin, and writing APIs through TanStack Query and Ky. GitHub
  reports it merged with successful check/e2e jobs. The PR deploy job was skipped;
  this is not evidence of the deployed staging version.

## How pagination currently works

The unified `/writing` archive shows ten published posts per page. Search, tags,
publication date, read duration and sorting combine in the same URL. Page links
preserve committed state, such as `/writing?q=worker&tag=cloudflare&sort=oldest&page=2`.
Changing search or applying the sheet resets pagination. Multiple tags match any
selected tag; search, date and duration narrow that set further.

The browser requests `/api/writing/posts` through Ky. TanStack Query distinguishes
all archive options and uses the existing one-minute freshness window. Client
loaders populate the same cache on navigation. Initial HTML contains the public
shell; cards load in the browser. Navigation uses the shared progress indicator.

PostgreSQL filters before counting and reading the page in a Neon HTTP batch,
using `LIMIT 10 OFFSET ((page - 1) * 10)` and a deterministic unique tie-breaker.
Drafts and archived posts are excluded. Standalone writing search/tag page
routes are removed; old blog search/tag links redirect directly to the unified
archive. Legacy API endpoints remain compatible.
Public API responses use `no-store`; browser query caching and server KV caching
are separate layers.

## Local samples

The default seed remains two published articles and one draft. Add 25 optional
demo articles to the local Compose database:

```bash
DATABASE_URL='postgres://indrax:indrax@127.0.0.1:4444/indrax?sslmode=require' npm run db:seed -- --pagination
```

This option rejects non-loopback database hosts. Fixture slugs are stable, so
rerunning it updates the same records and preserves unrelated posts.

| Route                                 | Page 1 | Page 2 | Page 3 |
| ------------------------------------- | ------ | ------ | ------ |
| `/writing` with the original fixtures | 10     | 10     | 7      |
| `/writing?tag=pagination-demo`        | 10     | 10     | 5      |
| `/writing?q=pagination%20demo`        | 10     | 10     | 5      |

Use the loopback URL in `.env.local` to browse those records with the local Worker.
`.env.local` can point to hosted Neon; the explicit URL above overrides it for
this command without editing that file. Direct SQL fixtures bypass application
cache invalidation, so an already-running local Worker may need its local public
cache invalidated or the cache TTL to expire. Do not seed demo content on staging
or production.

## Production release sequence

1. Base the release on current remote develop, including merged PR #54. Submit
   these follow-up changes to develop and require check/e2e jobs to pass.
2. Exercise dev.indrax.uk after its develop push deployment: archive paging,
   combined public/admin search/filters/sort and status paging, article SSR, draft isolation, OAuth, author save/publish, resume
   PDF, media uploads when configured, RSS, sitemap, and legacy redirects.
   Confirm the deployed revision rather than inferring it from a merged PR.
3. Verify Production environment CI credentials, public build variables, and
   the repository/organization gate `CLOUDFLARE_DEPLOY_ENABLED=true`. Preview and
   Production environment variables cannot enable a job-level gate on their own.
   Verify the production Worker's database,
   auth/OAuth origin and credentials, author ID, and optional R2 secrets. Keep
   dev/prod KV and D1 resources isolated. Ensure D1's revalidations table exists.
4. Review pending SQL migrations against production and apply required ones with
   the production migration connection. The unified public/admin discovery change uses existing columns
   and indexes and introduces no schema migration. Do not run local fixture seeding
   as a release step.
5. Open a develop-to-main release PR and review the full diff, because main is
   behind multiple develop features. Require the seeded browser and integration
   suites plus the normal check/build gates.
6. Merge the approved release PR. GitHub Actions deploys main using the generated
   `build/server/wrangler.json`, targeting indrax and its production domains.
   Before upload, `scripts/assert-deploy-target.mjs` resolves source configuration
   through Wrangler and verifies generated Worker name, routes, site URL and
   KV/D1 bindings. CI validates both production and develop builds; the seeded
   browser suite keeps its production-config/local-fixture coverage. Quality jobs
   cancel superseded runs independently; active deployments finish and deployment
   jobs serialize per branch.
   The dev build selects its environment with `CLOUDFLARE_ENV=dev`; use the
   project's npm scripts to keep build and deployment configuration aligned.
7. Verify production journeys, metadata/canonical origins and cold/warm request
   duration and CPU in Workers observability. Record the deployed version and
   previous known-good version. A Worker rollback does not undo database or
   storage changes, so migrations must remain compatible with the rollback plan.

List results retain migration PR #54's client-rendering model. Without JavaScript,
the search form can navigate to a shareable archive URL, but result cards require
the browser application. Browser coverage now asserts that actual contract.
Ordinary links alone do not make initially absent list results crawlable; server
initial results remain a separate optimization proposal below.

## Recommended next optimizations

1. **Generate the resume PDF during the build.** Currently the large renderer is
   imported only on click, but every visitor who downloads still downloads it
   and generates the same document. Emit a PDF from the existing typed resume
   data, serve it as a static asset, and keep download analytics and a helpful
   failure path. Validate text, links, fonts and pagination in the generated file.
2. **Consider server-provided initial archive results.** Hydrate TanStack Query
   with cached server loader data so first visits contain cards and pagination
   links, while subsequent navigation retains the API/cache behavior. Measure
   Worker CPU and first-content latency before adopting this: reduced client
   waiting and improved discoverability trade against extra server work.
3. **Measure deep archive pagination.** Stable ordering now includes a unique
   final tie-breaker. Keep offset pagination for the current small archive;
   consider cursors when deep-page query measurements justify it.
4. **Review browser asset caching.** Fingerprinted public and admin JS/CSS can
   use long immutable browser caching, while HTML and changing download URLs
   need revalidation. Workers static assets default to revalidation; inspect
   actual headers first. Keep private and signed-preview responses `no-store`.
5. **Measure before changing more cache policy.** Compare cold/warm article,
   archive, search, and social-image requests; inspect Neon, KV/D1 and rendering
   costs separately. Public API HTTP caching needs a publication/invalidation
   design rather than a blanket TTL. Compress and size cover images to their
   displayed card sizes and preserve explicit dimensions and first-card priority.

References: [React Router rendering](https://reactrouter.com/start/framework/rendering),
[Cloudflare Vite environments](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/),
[static asset headers](https://developers.cloudflare.com/workers/static-assets/headers/),
and [Worker rollback limitations](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

## Deployment verification limits

The repository defines distinct Worker/routes/KV/D1 targets and validates their
generated deployment configuration. Credentials and public analytics/media build
variables come from the branch-selected GitHub environment. Runtime secrets
remain separately configured on each deployed Worker and are not uploaded from
local `.env.local` or the CI fixture environment.

Production environment approvals/branch restrictions, Cloudflare API token scope,
remote database separation, D1 initialization and dashboard Git Builds state need
account-level evidence. Do not infer those controls from a passing local dry run.
No production migration or deployment is part of local validation.

References: [Cloudflare Vite environment selection](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/),
[GitHub variable availability](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#vars-context),
and [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).
