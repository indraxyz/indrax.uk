# Publication correctness and backend efficiency — issue #112

## Investigation and implementation plan

Public queries currently test status, date presence and content, while reactions
also test the publication time. Public result caches last an hour. Reaction PUT
performs a desired-state write and a separate aggregate request; revision lookup
performs one D1 request per previously uncached tag.

Implement and review in this order:

1. Share a publication predicate across public query/reaction paths, evaluated at
   call time. Preserve private preview/admin reads and intentional unavailable
   series-part metadata.
2. Version publication-dependent keys; retain one-hour freshness normally and
   shorten expiry to the next stored publication date. Query that deadline only
   on cold misses, alongside the loader. Keep rendered HTML revision-keyed.
3. Validate ordered Neon HTTP write/summary batching with the actual driver and
   concurrent disposable PostgreSQL tests.
4. Batch uncached D1 revision tags while preserving request memoization and fallback.
5. Benchmark reaction aggregation at 0, 100, 10,000 and 100,000 rows. Retain the
   existing aggregate/primary key unless measurements justify a change.

## Acceptance criteria

- Every public detail/list/archive/search/tag/feed/sitemap/recent/related/series
  and reaction path requires published status, content, a date and date <= now.
  Series navigation counts only readable parts; intentionally exposed unavailable
  part titles/slugs retain `published: false`. Preview/admin behavior is unchanged.
- The date predicate is evaluated for each read, including in a long-lived Worker.
  Rollout keys cannot reuse pre-fix future-visible results.
- Publication-dependent absence and lists must not be reused after the next
  publication date known at the read cutoff. Otherwise retain one-hour caching.
  A slow loader or late deadline lookup cannot extend that boundary. Failure to
  determine a deadline serves content without persisting it. RSS/sitemap revalidate.
  The existing browser cache may retain prior data until its next refresh; open
  tabs do not automatically refresh. There is no exact scheduler or new UI.
- Reaction GET stays one uncached query, PUT returns the same DTO/errors, and
  successful ordered batching uses one Neon HTTP request rather than two.
  Desired-state writes remain idempotent, visibility-guarded and visitor-isolated.
- D1 revision batching preserves missing-row zero, monotonic invalidation and
  request isolation. Measurements report calls and rows read separately.
- Public reaction responses remain no-store; API size/origin/JSON/rate-limit rules,
  SSR independence, sanitized rendering and private cache isolation remain intact.

## Measurement and decision gates

Use only isolated loopback PostgreSQL/Neon HTTP and local D1. Capture first-run
and warm timings separately; do not describe the first sample as a cold database
without a controlled buffer reset. Record engine/driver versions, sample counts,
conditions, p50/p95, actual request counts and EXPLAIN (ANALYZE, BUFFERS) plans.

Initial proposal: warm local HTTP summary p95 <=100ms at 100,000 rows, with
five warmups and 30 measured samples per dataset/operation. Compare ordered PUT
with the same sequential baseline. Adopt it only with the expected request-count
reduction, demonstrated latency benefit, passing concurrency/read-after-write
checks, and no material (>10%) p95 regression. Report local limitations and use
results to establish the final budget; do not infer production Neon latency.
The initial HTTP target was unmet even at zero rows. Final measured gates are
recorded in [the reaction benchmark](reaction-benchmark.md), including instrumented
and uninstrumented SQL evidence.

## QA and rollout

Use controlled Date clocks for pre/boundary/post publication tests, never sleeps.
Cover all public paths, series DTOs and preview isolation; cache absence/list
boundaries, slow reads, failures, missing tags, concurrent reads and invalidation;
actual-driver concurrent idempotency, cross-visitor selection and cascades.

Run the required check/build, disposable SQL integration suite and relevant
article/reaction browser suites with explicit loopback fixtures. Report actual
passes/skips/retries. Update architecture, cache, database and testing docs with
measured results and the freshness policy.

No deployment, production data export or speculative index/counter migration is
part of validation. CI owns deployment. Batching can be reverted independently while retaining the publication predicate.
A cache-policy rollback must use a fresh namespace and document its replacement
freshness bound; old namespace entries must not be made eligible again.

## Current administrative policy

The admin computes a first publication timestamp when publishing, preserves that
date across unpublish/republish, and exposes no scheduling control. Future dates
already stored through managed data/imports remain valid input and are hidden
until eligible. The change does not add scheduling or change authoring contracts.

## Free-tier decision

A fixed one-minute TTL was rejected after checking the current KV allowance. One
continuously hot key can require 1,440 writes/day under that policy. Retaining the
hour normally lowers the single-location/no-edits estimate to 24 writes/day, plus
publication transitions, while preserving correctness at stored dates. A cold
public miss pays one additional indexed deadline query in parallel; warm public
hits and browser contracts are unchanged. Cold/warm request counts and no-minute-
polling behavior are covered by actual-driver tests. No new paid service,
background poller, index, migration or counter table is introduced.

## Verification record

Final code is based on develop commit `61c3e5b`, after merging PR #113.
Validation used Node 24, an isolated migrated/seeded loopback PostgreSQL 17 stack,
local Neon HTTP proxy and local Workerd/D1; no developer environment files or live
infrastructure were used.

- `npm run check`: formatting, ESLint, type generation, TypeScript and 1,082 tests
  across 99 unit files passed.
- `npm run build`: public SSR Worker and independent admin bundle passed.
- Complete SQL integration suite: 108 tests across nine files passed.
- Browser invocation included the dependent reads project and selected reactions:
  403 passed, eight skipped, no retries. The skips were six admin-login cases,
  the auth-dependent editor-cover case and the sign-in breadcrumb case; their
  author/session prerequisites were not configured locally. The new future-dated
  SSR/reaction API and feed/sitemap checks executed and passed.
- D1 benchmark reproduced one request/two rows for detail plus render, compared
  with two requests/two rows previously. Same-clock invalidation advanced 12→14.
- Reaction HTTP and direct SQL measurements, plans, initial unmet target and
  final local budgets are retained in the linked benchmark reports/raw JSON.

Full CI, real Neon cold starts/remote-region timings and live quotas remain
separate verification. These local measurements do not guarantee unlimited
free-tier capacity. No manual deployment or production migration was performed.
