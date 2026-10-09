# Neon request latency optimization

The SQL layer uses Neon HTTP and Drizzle batching to reduce cumulative network waits.

Current code keeps minimal projections, tags aggregated in post reads, database
count/page batches, one-query admin list/editor reads, and atomic post/tag writes.
Ordinary saves with an unchanged explicit slug use two content SQL HTTP requests,
excluding auth and cache operations. Changed tags are synchronized in the same
write batch; unchanged memberships do not incur replacement writes. Existing series
resolution costs an additional request and remains outside the post/tag transaction.

Admin mutations return API DTOs; TanStack Query invalidates client data. Public metadata/article reads
share a request memo and KV/D1 public cache, while arbitrary searches and private
admin reads are never persisted. Home writing cards read through the browser API.

The real SQL suite verifies query budgets and rollback with an explicitly isolated
loopback database. See [testing](testing.md), [architecture](../ARCHITECTURE.md), and
[CPU/cache guidance](worker-cpu-optimization.md). Fewer network round trips reduce
potential cumulative waits; they do not themselves measure Worker CPU.

References: [Drizzle batch API](https://orm.drizzle.team/docs/batch-api),
[Drizzle relational queries](https://orm.drizzle.team/docs/rqb).
