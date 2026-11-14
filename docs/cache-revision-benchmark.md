# Cache revision request measurements — issue #112

## Reproduction and conditions

```bash
node --import tsx scripts/benchmark-cache-revisions.mjs
```

The script starts a fresh isolated in-memory local Workerd/D1 database, creates
exactly the existing `revalidations` schema, and inserts two indexed tag rows:
`posts = 12` and `post:example = 7`. It loads no environment files, project
configuration or remote bindings. It disposes the runtime on completion.

Recorded with Node **v24.16.0**, Miniflare **5.20261006.1-alpha**, and compatibility
date **2026-09-01**, matching the application. Each scenario executes once per
alternative. The metric is deterministic statement executions and the sum of
actual D1 `meta.rows_read`; this is not a latency benchmark or a measurement of
production billing. Database page caches are not flushed between alternatives.

The baseline executes the previous one-tag SQL with `.all()` instead of `.first()`
only to retain its metadata. The SQL and indexed lookup are unchanged. Each
alternative has its own empty request memo. Missing revisions resolve to zero.

## Results

| Request scenario                     | Baseline calls / rows read | `IN` calls / rows read | `UNION ALL` calls / rows read |
| ------------------------------------ | -------------------------- | ---------------------- | ----------------------------- |
| Detail: two tags, then render: one   | 2 / 2                      | 1 / 4                  | 1 / 2                         |
| Two present tags and one missing tag | 3 / 2                      | 1 / 5                  | 1 / 2                         |
| Two tags, repeated in the request    | 2 / 2                      | 1 / 4                  | 1 / 2                         |

All alternatives return identical ordered revision values. Repeated request
lookups add no statement or row-read work after the first lookup. The script also
executes the **production `cachedRead` path** for detail followed by rendering
against real D1: **one statement and two rows read**.

A parameterized `UNION ALL` of primary-key lookups is adopted because it reduces
statement executions without the observed row-read increase of the `IN`
alternative. The current article path requests at most two missing tags; no
schema, index, remote API or new storage service is introduced. This demonstrates
fewer D1 operations, not a measured remote latency improvement.

The same script verifies the actual production invalidation SQL against D1. With
`Date.now()` fixed at `12`, two successive invalidations move revision `12` to
`14`, confirming monotonic increments even when timestamps do not advance.

## Correctness and cache policy

Focused unit tests retain cold/warm KV behavior, absent bindings, missing revision
rows, duplicate and overlapping tags, pending revision memoization, invalidation
while a revision read is in flight, monotonic invalidation and read/write failures.
A failed invalidation continues to propagate to its mutation caller.

`cachedRead` accepts `{ lifetimeSeconds }`, a safe integer of at least 60 seconds.
Its default stays 3,600 seconds for saved article rendering. The lifetime is part
of both request and persistent keys, and the persistent namespace changes to
`react-router:v2` so old entries cannot bypass the new policy. Freshness is
measured from read start, before revision/KV work, rather than loader completion;
a loader that outlives that deadline is not persisted. Controlled-clock tests
cover cached absence and empty lists before and at a 60-second boundary.

The free-tier refinement adds `freshUntil(startedAt)` for publication-dependent
callers: retain an hour normally and shorten only to the next publication date.
The callback runs alongside the loader only on persistent misses. A failed lookup
serves data without caching; warm hits require no lookup. The generic 60-second
lifetime tests remain cache-API regressions, not the chosen production policy.

Publication-dependent callers and the freshness policy are described
in the [publication/backend specification](publication-backend-efficiency.md).
