# Public UI and post workflow refinements

Branch: `fix/public-ui-hydration-and-local-media`, based on `develop`.

## Public pages

Home and resume share a `Software Engineer` heading that scales from 24px on small
phones to a 32px desktop cap. LinkedIn and GitHub use icon links with accessible
names. The bottom row keeps personal information/PDF actions left and social links
right, including at 320px. Delivery sequence arrows and labels remain; the green
trace paths and animation styles are removed.

Public writing and admin posts share automatic search after 400ms, immediate
Enter submission and a clear action. Search preserves filters, resets pagination
and waits for IME composition to finish. A completed older search preserves newer
input; clearing also cancels a pending search. Browser Back restores applied text.
Public archives and search use nine cards per full page; admin lists retain ten.
Public page cache keys include page size to invalidate earlier ten-card results.

React Router's development critical CSS link had a server nonce without the
matching hydrated value. An application context now shares the document nonce
with framework links and scripts on both renders while retaining CSP.
Development hydration has its own browser configuration and CI step.
That check uses Vite's native configuration loader and a clean dependency cache.
Explicit TypeScript import extensions support the native loader; React Router's
built-in development dependency scan prevents late optimization from invalidating
the first browser request.

Stored local covers can retain an old port after `MEDIA_ORIGIN` changes. Only in
development, validated generated local URLs resolve against the configured origin;
editor fields use that URL so a subsequent save persists it. Production media
validation remains unchanged.

## Shared admin actions

Post cards retain a direct Edit icon. List, new and edit pages share one action
menu ordered as Visit/Preview, Publish/Unpublish, Archive, then a divider and
Delete. Archived posts omit Archive. New posts show disabled actions and a
save-first hint until the first successful save. Explicit target statuses drive
the shared confirmation dialog, including Archive.

Private previews retain signed expiry and saved-content requirements. A detached
blank tab opens during the click before signing to avoid popup blockers; failure
closes it and reports a retryable error. Published posts open the public article.
List actions use summary fields, refresh the active archive and preserve its URL,
filters and pagination. Archive retains the post and cover.

## Cover deletion and database integrity

Removing/replacing a saved cover or deleting its post queues managed R2 cleanup
in the same PostgreSQL transaction. The mutation locks the current post before
capturing its detached URL, including when another save or deletion overlaps.
Cleanup follows the successful transaction; cancellation or rollback keeps the
saved image. Pending work survives storage failure and retries on later successful
post mutations. Current shared cover and inline references retain the object.

Migration `0006_cover_cleanup` adds a deduplicated outbox with indexed retry
ordering and no cascading post foreign key. Existing post/tag/series relationships
are retained. See [database structure](database-structure.md) and
[R2 uploads](r2-uploads.md) for constraints, concurrency limits and retry behavior.
Apply the migration to the intended deployed database before deploying this code;
Worker deployment does not apply PostgreSQL migrations.

## Verification

The test guide documents the unit, SQL integration, production browser,
[development hydration and local upload suites](testing.md). Coverage includes
responsive layouts, action order and row isolation, status/delete confirmation
and retries, delayed search responses, pagination boundaries, database constraints,
concurrent cover mutations, shared references and storage failures. Upload tests
assert a saved cover returns 200 before removal and 404 after Save or post deletion.

Final release checks use a separately created local database migrated from scratch
and seeded with repository fixtures. No production database or remote storage is
changed. Production and develop deployment targets are checked locally. Real
GitHub OAuth and deployed staging behavior remain outside local verification.
