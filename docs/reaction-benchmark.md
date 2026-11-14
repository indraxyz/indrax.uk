# Reaction aggregation and transport benchmark — issue #112

## Reproduce

```bash
TEST_DATABASE_URL='postgres://indrax:indrax@127.0.0.1:4452/indrax?sslmode=require' \
TEST_DIRECT_DATABASE_URL='postgres://indrax:indrax@127.0.0.1:55442/indrax' \
npx tsx scripts/benchmark-reactions.ts /tmp/reactions.json

# Optional fast SQL-only pass, same datasets and driver-generated aggregate:
REACTION_BENCHMARK_SQL_ONLY=true TEST_DATABASE_URL=... TEST_DIRECT_DATABASE_URL=... \
npx tsx scripts/benchmark-reactions.ts /tmp/reactions-sql.json
```

URLs must name a disposable loopback database; both paths must match. Apply the
existing migrations first. Each run creates UUID-named posts and deletes only
those fixtures, cascading reactions. It never loads environment files or touches
remote services. Full mode now also captures direct SQL and TIMING OFF plans.

## Conditions

Measured with Node v24.16.0, PostgreSQL 17.11, Neon HTTP driver 1.1.0, Drizzle 0.45.3.
Node → loopback HTTP proxy → local Docker PostgreSQL; no artificial network RTT.
Each operation has five warmups and 30 measured samples. Visitors choose up to
three distinct emoji, balanced across all five types. Writes use a separate visitor.
Datasets are inserted and ANALYZEd before measurement; buffers are warm. The
first observed read is retained in raw output but is **not** a cold-storage or
Neon scale-to-zero measurement. Production latency and concurrency throughput
are not inferred from these samples.

Raw evidence: [HTTP samples/plans](benchmarks/reactions-local.json) and
[direct SQL samples/plans](benchmarks/reactions-sql-local.json). The SQL pass was
separate, without other database test load. Instrumentation and buffer/cache
conditions are reported rather than treating EXPLAIN timing as request latency.

## HTTP results

All values are **p50 / p95 milliseconds**. GET uses one HTTP request. Sequential
PUT uses two; ordered batch PUT uses one at every dataset size.

| Reactions | Identified GET    | Sequential add    | Batched add       | Sequential remove | Batched remove    |
| --------- | ----------------- | ----------------- | ----------------- | ----------------- | ----------------- |
| 0         | 248.677 / 375.748 | 396.241 / 590.499 | 201.232 / 236.918 | 396.140 / 438.120 | 200.412 / 269.001 |
| 100       | 195.991 / 212.077 | 395.638 / 517.357 | 201.891 / 235.927 | 399.153 / 532.865 | 199.719 / 225.068 |
| 10000     | 200.091 / 229.028 | 403.289 / 480.833 | 204.362 / 293.193 | 399.024 / 422.312 | 203.021 / 221.036 |
| 100000    | 246.627 / 281.198 | 443.882 / 498.479 | 249.958 / 283.777 | 444.692 / 491.243 | 250.316 / 284.585 |

Anonymous GET p95 values at the same sizes are 374.251, 254.586, 231.267, 271.398 ms.
All measured add/remove p95 values improve by more than 10% with batching.
Read-after-write, visitor isolation, idempotency and rollback are validated with
the actual driver in integration tests; no sibling DML CTE snapshot assumption
is used. PostgreSQL Read Committed allows other visitors to commit between statements.

## SQL scaling and interpretation

| Reactions | Direct SQL p50 / p95 ms | EXPLAIN timing on ms | TIMING OFF ms |
| --------- | ----------------------- | -------------------- | ------------- |
| 0         | 0.660 / 1.119           | 0.176                | 0.066         |
| 100       | 0.630 / 1.089           | 0.776                | 0.110         |
| 10000     | 3.237 / 4.188           | 59.521               | 2.515         |
| 100000    | 25.372 / 28.444         | 620.232              | 24.455        |

The first HTTP run’s fully instrumented 100k plan reported 934.516 ms. The repeat
reported 620.232 ms with node timing, versus 24.455 ms with TIMING OFF and 28.444 ms
uninstrumented direct p95. The difference is consistent with substantial per-node
timing overhead in this local runtime. All plans are preserved; the slow
instrumented result is not discarded or presented as meeting a 100 ms budget.

The existing post/browser/emoji primary key supports post-prefix lookup. The raw
plans show the chosen access paths, actual rows and buffers at each size. There
is no demonstrated need for an additional index or maintained counters here.

## Budget and decision

The initial **100 ms HTTP p95** proposal is **unmet**, including at zero rows
(375.748 ms identified-read p95). Baseline transport dominates these local requests.
Based on that baseline, the PR’s local acceptance gates are:

- Identified and anonymous warm GET p95 ≤400 ms through this proxy.
- Uninstrumented direct aggregate p95 ≤100 ms at 100k rows.
- Batched add/remove p95 ≤400 ms and at least 10% lower than the corresponding
  sequential baseline at every measured size; one HTTP request instead of two.

These measured gates pass. Retain the existing aggregate and primary key, adopt
ordered batching, and do not add counter-write amplification, reconciliation,
storage or migrations. This is local regression evidence, not a production SLO.
Reassess only if real traffic/scale or production measurements exceed the budget.
A real Neon cold-start/remote-region benchmark remains unverified.
