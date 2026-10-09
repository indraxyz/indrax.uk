# Worker CPU optimization

> Historical record of the pre-migration Next.js/OpenNext release. Commands and
> framework choices below are not current setup instructions. See
> [current architecture](../../ARCHITECTURE.md) and [migration](../react-router-migration.md).

## Problem and implementation plan

Branch: `fix/cloudflare-worker-cpu-limits`, based on `develop`. No ticket number
was supplied. This change is prepared for review; no deployment, billing
activation, or remote resource creation is part of implementation.

The `indrax-dev` invocation logs on 7 October 2026 confirmed `exceededCpu`
on post saves and public navigation, including prefetch requests. One save used
61 ms CPU and returned 503. Failures also affected `/`, `/writing`, `/resume`,
`/tech-stack`, and a tag page, so JSON parsing and article highlighting cannot
explain all failures. The tag page additionally returned HTTP 500 with
`DYNAMIC_SERVER_USAGE` while revalidating a stale route.

The implementation follows these steps:

1. Remove speculative internal-link prefetch and redundant navigation after save.
2. Keep save-time text extraction independent of the server rendering libraries;
   select existing post metadata only and reuse the extracted text for excerpts.
3. Load syntax highlighting only when sanitized article markup requires it.
4. Cache public HTML/headings by post ID, slug, saved revision, and renderer
   version. Expire with the existing per-slug mutation tag. Draft previews remain
   uncached. Bump `RENDER_VERSION` whenever sanitization/rendering rules change.
5. Render paginated tag routes explicitly per request with Next's `connection()`.
   Remove `generateStaticParams` from that route, retaining data caching and
   deduplicating metadata/page tag reads with React `cache`.
6. Configure OpenNext's built-in KV incremental cache, D1 Next-mode tag cache,
   memory revalidation queue, and cache interception. Keep development and
   production bindings separate.

## Cache choice and limits

R2 was not enabled on the account during investigation. KV + D1 is prepared as
the option that does not require R2 activation. OpenNext recommends R2 for
stronger consistency; this is a deliberate tradeoff for a small free-tier site.
KV is eventually consistent, including negative reads. D1 stores invalidation
timestamps separately, so old KV entries still pass through the tag validity
check, but propagation delays can produce additional cache misses/recomputation.
There is no extra regional/CDN cache layer to bypass that check.

The memory queue deduplicates only within an isolate. Article/data edits use
explicit expiration after mutations; the feed and sitemap retain their existing
hourly ISR backstop. Concurrent misses across isolates can repeat revalidation.
For higher traffic, use OpenNext's Durable Object queue; consider R2 for the
incremental cache.

Caching reduces repeat work, not the first render or the authenticated save
request. Workers Free allows 10 ms CPU per HTTP request and can terminate
requests that repeatedly exceed it. These changes do not promise that every
Next.js render/save fits under that budget. Free KV and D1 also have their own
daily operation limits; monitor them after release. No `cpu_ms` setting can raise
the free-tier limit.

## First release prerequisites — after review

The user has created separate development and production KV/D1 resources and
provided their IDs. Those IDs are now recorded in `wrangler.jsonc`. The agent has
not created remote resources or deployed the Worker. Local preview continues to
use local KV/D1.

| Environment | KV namespace ID                    | D1 database            | D1 database ID                         |
| ----------- | ---------------------------------- | ---------------------- | -------------------------------------- |
| Development | `55163065696741c397d875991d3eb8d6` | `indrax-dev-next-tags` | `090d17c4-739d-4e61-ae9a-2678fe379a9b` |
| Production  | `3b3a56d04aed4aca8492ab4d46002923` | `indrax-next-tags`     | `768e0a3c-8014-4b32-9a7f-39f2b7ee2a58` |

Keep the OpenNext binding names `NEXT_INC_CACHE_KV` and `NEXT_TAG_CACHE_D1`.
Wrangler's generated D1 suggestions (`indrax_dev_next_tags` / `indrax_next_tags`)
must not replace the binding name expected by the adapter.

The commands below document provisioning for a future replacement; do not
recreate the resources already configured:

```bash
# Development only
npx wrangler kv namespace create NEXT_INC_CACHE_KV --env dev
npx wrangler d1 create indrax-dev-next-tags --env dev

# Production only
npx wrangler kv namespace create NEXT_INC_CACHE_KV --env=""
npx wrangler d1 create indrax-next-tags --env=""
```

Record each KV namespace's `id` and each D1 database's `database_id`. Never reuse
development IDs in the top-level production config. Check with:

```bash
node scripts/check-worker-cache.mjs dev
node scripts/check-worker-cache.mjs
```

The release scripts run this check before building/deploying, failing early if
resources are missing. Wrangler's automatic provisioning during upload is too
late here: OpenNext populates caches **before** it invokes Wrangler deploy.
OpenNext initializes/migrates its D1 `revalidations` table and populates build
entries during preview/deploy. The application database remains Neon Postgres;
D1 contains only cache invalidation timestamps.

The deployment token needs KV and D1 access in addition to the existing Worker
permissions. Review those scopes when provisioning, then use the existing
GitHub release pipeline after approval. Do not run the deploy scripts merely
to validate this branch.

## Verification

Unit tests cover lightweight text extraction, lazy highlighter initialization,
sanitization/highlighting without runtime WASM compilation, save validation and
authorization, published timestamps, old/new slug invalidation, navigation
behavior, the tag request-rendering boundary, pagination metadata, public render
cache hits/revisions/invalidation, and environment binding separation.

`npm run cf-typegen` regenerates the Worker binding/runtime declarations after
binding changes. The generated `cloudflare-env.d.ts` is gitignored and excluded
from Next.js's DOM-based TypeScript project and ESLint. Its global Workers
`Response` and required environment declarations must not override browser
types. OpenNext configuration is still included in application type checks;
no application code directly accesses these bindings.

Browser coverage extends the existing authoring lifecycle with a tag that did
not exist at build time: draft-only 404, publish, canonical/indexability, save,
revisit/reload, page-two canonical, and unpublish returning 404. Tests must run
against an isolated local database, never the remote Worker/production database.

Run `npm run check`, the seeded browser suite, the OpenNext build, and Wrangler
`deploy --dry-run` for packaging. Local Node/Worker tests cannot establish
production CPU compliance. After an approved release, compare failed invocation
outcomes, `cpuTimeMs`, HTTP statuses, and prefetch volume in Observability.

### Local results (8 October 2026)

- `npm run check`: formatting, lint, TypeScript, and all 173 unit cases passed.
- Seeded full browser suite: 151 passed, 1 skipped. After adding the final
  navigation/body-cache regression, the focused suite passed 14 cases with 1
  skipped (media R2 configuration unavailable).
- Full `opennextjs-cloudflare build --env dev` completed. A regular Next build
  cannot be reused with `--skipNextBuild` here: OpenNext needs its standalone
  tracing artifacts, including instrumentation traces.
- Direct Wrangler `deploy --dry-run` passed for development and production,
  with `OPEN_NEXT_DEPLOY=true` to bypass adapter deployment hooks. Neither
  command uploaded or provisioned anything.
- OpenNext local preview populated 64 local KV entries and initialized local
  D1. Home, archive, tag, tag pagination, highlighted article, RSS, and sitemap
  each returned 200 with expected content on two consecutive requests.
- After recording the user-provided resource IDs, both environment preflight
  checks and all seven cache configuration/preflight tests passed. Direct
  Wrangler dry-runs were repeated with the configured dev/production IDs;
  no remote cache data was populated.

The adapter emitted nonfatal traced-dependency copy messages and its existing
Node middleware experimental warning; Wrangler emitted a duplicate `axisIndex`
key warning from bundled font code. The completed build, packaging checks, and
local runtime smoke passed despite those messages. Local response durations are
wall time, not evidence of compliance with production CPU limits.

References: [OpenNext caching](https://opennext.js.org/cloudflare/caching),
[Next.js connection](https://nextjs.org/docs/app/api-reference/functions/connection),
[Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/),
[KV limits](https://developers.cloudflare.com/kv/platform/limits/).
