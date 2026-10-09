# Neon request latency optimization

> Historical record of the pre-migration Next.js/OpenNext release. Commands and
> framework choices below are not current setup instructions. See
> [current architecture](../../ARCHITECTURE.md) and [migration](../react-router-migration.md).

Branch: `fix/neon-request-latency`, based on the merged `develop` branch.
Prepared for review; no remote database writes, deployment, or infrastructure
changes are part of this implementation.

## Evidence and plan

Dev Worker screenshots on 8 October 2026 showed a save trace lasting 9.42 seconds:
nine sequential `/sql` requests consumed 5.53 seconds, six more consumed 1.65
seconds, and D1 invalidation took 98 ms. A home `HEAD` request waited on two
sequential SQL requests (1.88 seconds and 462 ms). The writing archive showed
three SQL requests grouped over 2.53 seconds and another lasting 777 ms, alongside
KV reads/writes. These are wall-clock durations; they do not attribute CPU cost
or prove a particular query is slow on the database itself.

The implementation reduces network round trips using the existing Neon HTTP
driver, Drizzle relations/batching, and React request memoization:

1. Deduplicate author checks within the React server request, while retaining
   authorization guards at every action and admin read boundary.
2. Read admin posts with their tags and series through existing Drizzle relations
   in one SQL request. List pages never transfer article bodies.
3. Aggregate public card/article tags inside the post query. Batch pagination
   counts and rows; only a stale out-of-range page needs a corrective request.
4. Batch series navigation reads and return publication booleans instead of
   downloading every part's document. An article body appears once in its result.
5. Skip unchanged explicit-slug checks. Synchronize post/tag writes atomically
   in one batch, deleting only unwanted joins and preserving existing joins.
   Resolve series with one returning upsert, preserving existing titles and descriptions when input is blank.
6. Use returning deletes and minimal projections for status/preview actions.
7. Read admin overview counts and the latest draft using one minimal batch,
   avoiding every post's tags and summary. Remove the redundant refresh after
   status changes and deletion navigation.
8. Deduplicate public article/series reads between metadata and page rendering
   with React request caching. Reuse social-card font bytes within the Worker
   isolate, retrying font loads after a transient failure.

Correlated select expressions use a shared escaped identifier helper because
Drizzle's single-table select builder otherwise strips inner column qualifiers.
Unit SQL-generation tests and actual Postgres tests cover this behavior. Tag
membership is synchronized inside the write transaction rather than inferred
from an earlier read, so overlapping saves retain the last save's submitted tags.

## Request budgets

Numbers below count Neon HTTP requests for application data, excluding Better
Auth's own session queries, Next's rerender, and KV/D1 operations.

| Operation                                     |            Previous |                                 Now |
| --------------------------------------------- | ------------------: | ----------------------------------: |
| Existing save, same explicit slug, no series  |         7 with tags |                                   2 |
| Save with a series                            |           2–3 extra |                             1 extra |
| New save, explicit slug, with tags, no series |                   6 |                                   2 |
| Admin overview                                | Full list with tags |                     1 minimal batch |
| Admin list                                    |                   2 |                                   1 |
| Admin edit                                    |                 2–3 |                                   1 |
| Archive/tag/search page                       |                   3 | 1 batch; 2 for deep-page correction |
| Recent/feed/related cards                     |                   2 |                                   1 |
| Article with series                           |                   4 |                                   2 |
| Series page                                   |                   2 |                                   1 |
| Delete                                        |                   2 |                                   1 |

The existing parallel archive/tag-list reads remain parallel. Cache tags, draft
isolation, pagination bounds, safe read fallbacks, and mutation invalidation are
preserved. No persistent authentication cache or new infrastructure is introduced.

## CPU work across public and admin routes

The preceding Worker CPU fix already introduced a lightweight plain-text save
path, lazy JavaScript syntax highlighting, saved-revision public render caching,
and disabled speculative navigation prefetch. This phase further reduces SQL
response decoding, article-body transfer, repeated author checks, and redundant
admin renders. Public cards never select full documents; series navigation uses
publication booleans rather than transferring each article body.

The editor and PDF export are already loaded in the browser. Image uploads go
directly to R2 using presigned URLs. Draft previews remain uncached and author
checks stay request-scoped. These existing choices prevent heavy work or private
responses from being moved into a persistent shared cache.

Cold public rendering, uncached previews, and dynamic social-card drawing still
need Worker CPU. Local tests prove behavior and request budgets; they cannot
establish that every invocation fits the free-tier CPU allowance. Compare CPU
and wall-clock duration separately on the deployed Worker, including cold/warm
reads and content with highlighted code.

## Verification

Final local results on 8 October 2026:

- `npm run check`: formatting, lint, TypeScript, and 234 tests in 28 files passed.
- `npm run test:integration`: 13 real-database tests passed on an isolated,
  migrated/seeded local Postgres/Neon proxy.
- Full Playwright suite: 152 passed, one R2 upload test skipped because dedicated
  test credentials were unavailable; four workers, zero retries.
- Full OpenNext dev Worker build and Wrangler dev deployment dry-run passed.
  Existing adapter dependency-tracing/middleware and bundled-font warnings remain.
  No remote Worker deployment or database migration was performed.

Unit tests cover request-scoped author memoization and new-request rejection,
real Drizzle SQL construction/decoding, public visibility, pagination, raw/wrapped
database errors, and mutation batch paths.

A separate database integration suite runs actual SQL and transactions through
the Neon HTTP proxy. It counts HTTP requests and verifies tag correlation,
changed/unchanged/cleared tag membership, newly created posts/tags, series
description preservation, overlapping saves, unchanged join preservation, and
post/tag rollback after a series-position conflict.
The authentication and Next cache boundaries are mocked only in that SQL suite;
the browser suite covers the complete application flow.

Use a migrated, isolated local database. `TEST_DATABASE_URL` is required and must
use a loopback hostname; there is no fallback to `.env.local` or `DATABASE_URL`.
The suite removes only its own fixtures by ID. For example, with the repository's
local test stack:

```bash
TEST_DATABASE_URL='postgres://indrax:indrax@127.0.0.1:4444/indrax?sslmode=require' npm run test:integration
```

Normal `npm run check` excludes this database suite. CI runs it against its
ephemeral local Postgres/Neon proxy before the browser suite.

Series metadata upserts still happen before the post/tag transaction, matching
the existing behavior: a rejected post save can update shared series metadata.
This change guarantees atomic post/tag writes, not a transaction spanning the
entire save workflow. Concurrent slug/series conflicts remain database-enforced.

After an approved release, compare SQL span counts and durations for home,
archive, admin edit/list, and save. Test cached and uncached reads separately.
Fewer HTTP trips should reduce cumulative network waits, but actual production
latency and CPU require measurement; Neon wake-up/location and KV propagation
delays remain possible contributors.

References: [Drizzle batch API](https://orm.drizzle.team/docs/batch-api),
[Drizzle relational queries](https://orm.drizzle.team/docs/rqb),
[React cache](https://react.dev/reference/react/cache).
