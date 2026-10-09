# Neon request latency optimization

The October 2026 SQL optimization is retained in the React Router migration.
[Historical measurements and release results](history/next-neon-latency-optimization.md)
describe the earlier Next/OpenNext release; they are not new-framework CPU results.

Current code keeps minimal projections, tags aggregated in post reads, database
count/page batches, one-query admin list/editor reads, and atomic post/tag writes.
Ordinary saves with an unchanged explicit slug use two content SQL HTTP requests,
excluding auth and cache operations. Changed tags are synchronized in the same
write batch; unchanged memberships do not incur replacement writes. Existing series
resolution costs an additional request and remains outside the post/tag transaction.

React Router removes the old server-action rerender path. Admin mutations return
API DTOs; TanStack Query invalidates client data. Public metadata/article reads
share a request memo and KV/D1 public cache, while arbitrary searches and private
admin reads are never persisted. Home writing cards read through the browser API.

The real SQL suite verifies query budgets and rollback with an explicitly isolated
loopback database. See [testing](testing.md), [architecture](../ARCHITECTURE.md), and
[CPU/cache guidance](worker-cpu-optimization.md). Fewer network round trips reduce
potential cumulative waits; they do not themselves measure Worker CPU.

References: [Drizzle batch API](https://orm.drizzle.team/docs/batch-api),
[Drizzle relational queries](https://orm.drizzle.team/docs/rqb).
