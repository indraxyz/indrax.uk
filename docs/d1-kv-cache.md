# D1 and KV cache: local development and deployed Workers

This guide describes the implementation in this repository. PostgreSQL remains
the source of truth; D1 and KV support the public server cache. See
[architecture](../ARCHITECTURE.md), [environment setup](project-structure-and-environment.md)
and [release preparation](public-site-release.md) for the surrounding application.

## Responsibilities and implementation

| Storage                 | Contents in this application                                | Owner                                          |
| ----------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| PostgreSQL              | Posts, tags, series, author identities and sessions         | Drizzle and the Neon HTTP driver               |
| KV: `NEXT_INC_CACHE_KV` | Cached public query results and rendered published articles | [cache implementation](../lib/cache.server.ts) |
| D1: `NEXT_TAG_CACHE_D1` | Cache-tag revision values in `revalidations`                | The same cache implementation                  |

The binding names retain their existing names from earlier infrastructure. They
are accessed through Worker bindings and the request context, not through Next.js
or a database connection string in `.env.local`. The source configuration is
[wrangler.jsonc](../wrangler.jsonc); [workers/app.ts](../workers/app.ts) establishes
the request context for public routes and API handlers.

### Public reads

1. `cachedRead` memoizes a result within the current Request.
2. It reads each cache tag's revision from D1. A missing tag row means revision `0`.
3. It hashes the logical query key, tags and revisions into a KV key starting with
   `react-router:v1:`.
4. A valid KV entry returns its `data`. Each entry also has `expiresAt`, and the KV
   expiration TTL is **3,600 seconds**.
5. On a miss, the loader queries PostgreSQL or renders the published document.
   KV writes run through `ExecutionContext.waitUntil` when available.

The public default writing archive uses KV when there is no query or tag/date/
duration filter and the sort is Newest. Its bounded page options remain part of
the key. Arbitrary search/filter combinations and alternate sorts query
PostgreSQL directly. Other public helpers cache recent posts, tags, feed data,
related posts and published slugs; see [public queries](../features/writing/data/queries.server.ts).
Published article rendering includes post ID, slug, `updatedAt` and renderer
version in its key; see [render cache](../features/writing/data/rendered-article.server.ts).

Admin reads, sessions and draft previews never enter this public KV cache. Browser
TanStack Query caching is separate. Public API `no-store` response headers do not
disable the server's internal KV cache. Social-image response caching uses a
separate Workers Cache API helper; it is not this KV/D1 mechanism.

### Saving, publishing and deleting

Post mutations await `invalidateTags` after the PostgreSQL write. The shared
`posts` tag invalidates affected public lists, feeds and metadata; `post:<slug>`
invalidates article reads/rendering. Changing a slug touches both old and new
slug tags. D1 inserts or advances the revision with a batched upsert, then clears
the current Request's memoized results and revisions.

Subsequent reads use a different KV key. Invalidation does not enumerate/delete
old KV values; they expire through their TTL. KV propagation can still cause
misses and repeated rendering. This design does not lock simultaneous misses or
make PostgreSQL and D1 one cross-storage transaction. If invalidation fails after
a database write, inspect the persisted post before assuming the write rolled back.

## Local storage locations

Run commands from the repository root. The current configuration simulates D1
and KV locally; it has no remote development binding enabled.

| Runner                               | Configuration                                                  | Persistence root                |
| ------------------------------------ | -------------------------------------------------------------- | ------------------------------- |
| `npm run dev`                        | Root `wrangler.jsonc` through the Cloudflare Vite plugin       | `.wrangler/state/`              |
| `npm run start` or `npm run preview` | Generated `build/server/wrangler.json`, Wrangler `dev --local` | `build/server/.wrangler/state/` |

The current installed runtime stores files below `v3/`:

```text
.wrangler/state/v3/
  d1/miniflare-D1DatabaseObject/<generated-id>.sqlite
  kv/miniflare-KVNamespaceObject/<generated-id>.sqlite
  kv/<namespace-id>/blobs/<generated-id>
```

Preview uses the same shape below `build/server/.wrangler/state/v3/`. SQLite
metadata and WAL/SHM files may also appear. These paths describe the current
runtime's internal format: generated filenames are not database names and should
not be edited by hand.

`.wrangler` is hidden and ignored by Git. In a Linux file manager, Ctrl+H reveals
hidden files. To locate local state, including ignored files:

```bash
ls -la .wrangler/state/v3
rg --files --hidden --no-ignore .wrangler/state/v3
rg --files --hidden --no-ignore build/server/.wrangler/state/v3
```

These two persistence roots are independent. A warm development cache does not
imply a warm preview cache. `npm run clean` removes `build/`, including preview
state, but keeps root `.wrangler/`; rebuilding may also replace generated preview
state. Local state is disposable and does not synchronize with Cloudflare.

### Initialization and environment selection

[The dev runner](../scripts/dev.mjs) and [preview runner](../scripts/preview.mjs)
call [initializeLocalCache](../scripts/local-cache.mjs) before serving. It executes
this statement against **local D1 only**:

```sql
CREATE TABLE IF NOT EXISTS revalidations (
  tag TEXT PRIMARY KEY,
  revalidatedAt INTEGER NOT NULL
);
```

No D1/KV seed is required. KV fills when cacheable public content is requested;
D1 tag rows appear when a post mutation invalidates them. PostgreSQL migrations
and `db:seed` manage post data separately.

Local Worker secrets use `.env.local`. CI can run without this developer file:
the preview runner passes existing local files only, then creates a protected
temporary dotenv file for allowlisted shell fixtures and the preview auth origin.
It removes that temporary file after exit. This does not create a remote resource.

The default source configuration uses the production resource identities for
**local simulation**, without contacting those remote resources. Running
`CLOUDFLARE_ENV=dev npm run dev` selects development identities in local state.
Match the inspection command's environment to the running application. The
generated preview config already contains its selected environment; do not add
`--env dev` to that flattened config.

### Inspect development state

These commands are read-only and explicitly target the default local identities:

```bash
npx wrangler d1 execute NEXT_TAG_CACHE_D1 --config wrangler.jsonc --env "" --local --persist-to .wrangler/state --command "SELECT tag, revalidatedAt FROM revalidations ORDER BY tag;"
npx wrangler kv key list --binding NEXT_INC_CACHE_KV --config wrangler.jsonc --env "" --local --persist-to .wrangler/state --prefix react-router:v1:
npx wrangler kv key get '<key-from-list>' --binding NEXT_INC_CACHE_KV --config wrangler.jsonc --env "" --local --persist-to .wrangler/state --text
```

For a dev-environment local server, replace `--env ""` with `--env dev` in these
source-config commands. An empty tag table before mutations or an empty KV before
cacheable visits is expected.

### Inspect preview state

Use the generated config and preview persistence root together:

```bash
npx wrangler d1 execute NEXT_TAG_CACHE_D1 --config build/server/wrangler.json --env "" --local --persist-to build/server/.wrangler/state --command "SELECT tag, revalidatedAt FROM revalidations ORDER BY tag;"
npx wrangler kv key list --binding NEXT_INC_CACHE_KV --config build/server/wrangler.json --env "" --local --persist-to build/server/.wrangler/state --prefix react-router:v1:
```

## Deployed develop and production

On Cloudflare, KV and D1 are managed remote resources accessed through the Worker's
bindings. Their data is not stored in the application's deployed asset files or
uploaded from local SQLite/blobs.

| Branch    | Worker / domain                         | D1 database            | KV selection                               |
| --------- | --------------------------------------- | ---------------------- | ------------------------------------------ |
| `develop` | `indrax-dev` / `dev.indrax.uk`          | `indrax-dev-next-tags` | `env.dev.kv_namespaces` in source config   |
| `main`    | `indrax` / `indrax.uk`, `www.indrax.uk` | `indrax-next-tags`     | Top-level `kv_namespaces` in source config |

Both Workers use the same binding names but distinct configured resource IDs.
The IDs in `wrangler.jsonc` are authoritative; no IDs need to be copied into
`.env.local`. Deployment validates the generated config's Worker, domains, site
URL and KV/D1 bindings before upload. Worker code deployment does not seed D1 or
copy local caches. Existing remote data persists independently of code versions.

### Remote inspection

Use the Cloudflare dashboard's D1 database and KV namespace views, or these
read-only commands with an authenticated account that can access the resources:

```bash
# Develop
npx wrangler d1 execute NEXT_TAG_CACHE_D1 --config wrangler.jsonc --env dev --remote --command "SELECT tag, revalidatedAt FROM revalidations ORDER BY tag;"
npx wrangler kv key list --binding NEXT_INC_CACHE_KV --config wrangler.jsonc --env dev --remote --prefix react-router:v1:

# Production
npx wrangler d1 execute NEXT_TAG_CACHE_D1 --config wrangler.jsonc --env "" --remote --command "SELECT tag, revalidatedAt FROM revalidations ORDER BY tag;"
npx wrangler kv key list --binding NEXT_INC_CACHE_KV --config wrangler.jsonc --env "" --remote --prefix react-router:v1:
```

`--local` and `--remote` explicitly select different stores. The same binding name
does not imply the same database or KV namespace across environments.

### Preparing remote D1

For a newly provisioned environment, its D1 database must contain the
`revalidations` table before accepting post mutations. The local initialization
script does not prepare remote D1. Apply the SQL above as a reviewed release step,
using the intended environment and `--remote`; for example, for develop:

```bash
npx wrangler d1 execute NEXT_TAG_CACHE_D1 --config wrangler.jsonc --env dev --remote --command "CREATE TABLE IF NOT EXISTS revalidations (tag TEXT PRIMARY KEY, revalidatedAt INTEGER NOT NULL);"
```

For production, use `--env ""` with the production database/account explicitly
verified. This command changes remote schema; it is an operator action, not part
of local startup or CI fixtures. KV needs its namespace binding but no schema or
seed. Neither resource replaces PostgreSQL migrations, credentials or isolation.

## Troubleshooting

| Symptom                              | Check                                                                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Cannot find files                    | Reveal hidden/ignored files and inspect the matching runner's persistence root                                               |
| KV list empty                        | Verify environment/root, request an unfiltered Newest archive or published article, and allow background writes to finish    |
| D1 has no tag rows                   | Tag rows appear on invalidation; a newly initialized table can be empty                                                      |
| `no such table: revalidations`       | Verify the selected local startup initialization or prepare the intended remote D1 table                                     |
| Cache read/write errors              | Look for structured `cache.read` / `cache.write` errors in local logs or Worker Observability; reads fall back to the loader |
| Data differs between dev and preview | Their state roots are independent; also verify the selected PostgreSQL database                                              |
| Save reports an error involving D1   | Verify binding/table/access and inspect the persisted post; invalidation follows the database write                          |

If either cache binding is absent, reads use the loader without persistent KV
caching. D1/KV errors do not imply PostgreSQL is unavailable. To reset local
cache state, stop that local runner, remove only its `state/v3/d1` and `state/v3/kv`
directories, then restart to recreate D1 and warm KV. This deletes local cache
and revisions, not PostgreSQL posts. Do not clear remote D1 revisions alone while
retaining old KV keys: resetting revisions can make an old revision key reachable.
Remote cache recovery requires a coordinated, reviewed procedure.

References: [Wrangler D1 commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/),
[Wrangler KV commands](https://developers.cloudflare.com/workers/wrangler/commands/kv/),
and [Cloudflare Vite persistence](https://developers.cloudflare.com/workers/vite-plugin/reference/api/#persiststate).
