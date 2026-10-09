# Worker CPU and cache guidance

Current runtime: React Router 8.4.0 public SSR + independent admin CSR, on Cloudflare
Workers through Vite. This replaces the Next/OpenNext implementation documented in
[the historical investigation](history/next-worker-cpu-optimization.md).

## What changed

Initial dev observations showed both CPU-limit errors and long SQL waits. Later
samples improved wall time while admin CPU still ranged from tens to hundreds of
milliseconds. JSON parsing alone did not explain expensive GET admin requests.
The migration separates work by purpose:

- Home/profile/resume/stack and published article content retain SEO SSR.
- Home writing cards and public archive/tag/search/series results load through APIs.
- Admin ships a separate static CSR bundle with no public React SSR import.
- Browser data fetching uses TanStack Query and Ky, with deliberate cache/retry rules.
- Private APIs retain author verification, server validation, derived fields and
  atomic writes; CSR cannot move these trust boundaries into the browser.
- Signed draft previews return sanitized article HTML through an uncached API,
  avoiding React page SSR while keeping the content policy centralized.
- Existing minimal queries, Neon batching, lightweight text extraction, lazy Shiki
  initialization and revision-keyed public rendering remain in use.

This is an architectural reduction of unnecessary Worker work, not evidence that
all requests now fit a free-tier CPU limit. Database/network waiting contributes
to wall time separately from JavaScript CPU work.

## Existing storage

| Environment | KV namespace                       | D1 database            | D1 ID                                  |
| ----------- | ---------------------------------- | ---------------------- | -------------------------------------- |
| Development | `55163065696741c397d875991d3eb8d6` | `indrax-dev-next-tags` | `090d17c4-739d-4e61-ae9a-2678fe379a9b` |
| Production  | `3b3a56d04aed4aca8492ab4d46002923` | `indrax-next-tags`     | `768e0a3c-8014-4b32-9a7f-39f2b7ee2a58` |

Keep bindings `NEXT_INC_CACHE_KV` and `NEXT_TAG_CACHE_D1` so the existing environment
configuration continues to work. They are now application bindings rather than
adapter bindings. Do not recreate or share these resources across environments.
Neon remains the content/auth database; D1 contains only invalidation revisions.

`lib/cache.server.ts` uses the existing `revalidations(tag, revalidatedAt)` table.
D1 monotonic tag revisions become part of hashed KV keys under `react-router:v1`,
so old framework cache entries and pre-invalidation entries cannot be served.
KV data expires after one hour; misses read from Neon and write through `waitUntil`.
Per-request memoization avoids duplicate data reads without caching author sessions
across requests. Mutations await invalidation before returning success. Article
render entries carry saved revision and renderer version. Draft/private reads
never use the public cache.

An existing D1 created for the earlier release should already have the table.
A replacement/empty D1 needs the same schema before its first invalidation:

```sql
CREATE TABLE IF NOT EXISTS revalidations (
  tag TEXT PRIMARY KEY,
  revalidatedAt INTEGER NOT NULL
);
```

Do not run remote database commands merely to check a branch. Confirm resources
and schema through the approved release procedure. Local preview uses local
bindings, not remote KV/D1. A missing cache binding permits uncached reads; D1
failures during invalidation must not be treated as a successful fresh save.

KV is eventually consistent. Revision keys avoid serving old data, but propagation
may produce extra misses and repeated renders. Simultaneous misses across isolates
are not deduplicated. Free storage operation quotas must be monitored independently
from Worker CPU limits.

## Public social image response cache

Public social-card PNG responses use Cloudflare's built-in `caches.default`, in a
private internal URL namespace reserved for image cache keys. Keys include the
supported card path and a unique build ID; writing card keys additionally include
post ID and saved revision. The current public post is resolved before cache lookup,
so an unpublished post cannot continue serving an old cached card. Arbitrary card
paths and unbounded slugs are rejected before rendering or cache access.

Successful public PNGs are stored for one hour through `waitUntil`, and a hit skips
Satori/image rendering. Visitor cookies and Authorization headers never enter the
key. Error responses, non-PNGs, private/no-store responses and Set-Cookie responses
are not stored. A Cache API failure logs a safe error and falls back to rendering;
Node tests may run without this Cloudflare API. HEAD can reuse cached image metadata.

The Cache API is local to a Cloudflare data center, not a globally replicated cache.
A first request in another location may still render; simultaneous misses can render
more than once. This reduces repeat image CPU without promising a cold-render budget.
See [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/).

## Measurement procedure

1. Build the production Worker and use `npm run start` to run that artifact in local
   Workerd. Do not use development React timings as production CPU evidence.
2. Record CPU profiles separately for public article, admin login/new/edit, list,
   create and save. Use the Wrangler DevTools profiler; inspect Bottom Up and
   flame charts for initialization, crypto, validation, serialization and rendering.
3. Compare the first request after restart with repeated requests. Keep the same
   body/document and session; test short text and code-heavy content separately.
4. Keep SQL spans, request counts and wall time beside CPU results. Reduced SQL
   waits do not demonstrate reduced rendering or validation CPU.
5. After an approved dev release, inspect invocation CPU time, wall time, status,
   cache misses and error outcomes on the same scenarios. Production invocation
   metrics are the final evidence of platform behavior.

Workers Free documents 10 ms CPU per HTTP request, with limited tolerance for
occasional spikes. Successful requests above that figure are not a promise that
sustained usage is safe. Changing a `cpu_ms` setting cannot raise a free-plan limit.
Rendering/social images and first-time highlighting still run on the server;
measure them before declaring budget compliance.

The suite verifies functional/security behavior, transaction/query budgets and
packaging, not a production CPU ceiling. Record measured results separately from
inferred savings. See [testing](testing.md) and [the architecture](../ARCHITECTURE.md).

References: [Workers CPU limits](https://developers.cloudflare.com/workers/platform/limits/#cpu-time),
[CPU profiling](https://developers.cloudflare.com/workers/observability/dev-tools/cpu-usage/),
[KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/),
[React Router rendering](https://reactrouter.com/start/framework/rendering).
