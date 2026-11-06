# Pending media upload lifecycle

This extends the inline-image work on `feat/inline-images-card-carousels` (PR #96).
The original verification record below describes that change. The subsequent
Workers Previews migration retains hourly production cleanup, but invokes staging
cleanup after deployment or manual maintenance through a protected test route;
Previews do not receive Cron Triggers. See
[Preview maintenance](development-and-deployment.md#preview-bootstrap-and-cleanup).

## Plan

1. Add a Drizzle migration for tracked uploads and guarded lifecycle transitions.
2. Record each verified upload before writing its generated object to R2.
3. Attach referenced uploads in the same database transaction as a successful post save.
4. Run bounded hourly cleanup of unreferenced pending uploads older than 24 hours.
5. Reuse the existing detached-image cleanup path and storage safety checks.
6. Verify failures, retries, shared references and concurrent save/cleanup with real SQL.
7. Run repository/browser checks, update documentation and ship through PR #96.

## Specification

Uploads remain explicit: selecting a file previews it locally; confirming Insert/Update
image uploads it; saving the post persists the content. The shared pipeline tracks both
content and cover uploads without adding a second upload API or storage service.

A generated key and its canonical URL are registered as pending before the R2 write.
If registration is unavailable, the upload returns a readable error without writing an
untracked object. Failed or uncertain R2 writes retain their pending record for cleanup.

Successful post saves mark their referenced managed uploads attached in the same Neon
batch transaction as the document/cover and tags. Failed saves roll attachment back.
Matching uses generated keys, allowing valid development media URLs to change ports.
Legacy uploads and third-party HTTPS images remain usable; this does not list or delete
historical objects without a tracking record.

The shared cleanup function processes at most 20 pending/deleting uploads per invocation.
Pending uploads become eligible after 24 hours. The cleanup worker verifies the stored
URL against the current environment's media configuration and rechecks all saved posts,
including drafts, archived posts, covers and inline images. Referenced assets are kept.
R2 failures retain work for later retry. Deletion is idempotent, and completed deletion
leaves a small tombstone to prevent an old editor tab from reattaching a missing file.

Cleanup atomically claims an unreferenced asset as deleting. Attachment and cleanup
serialize on its tracking row. A database transition guard rejects attaching an asset
that cleanup already claimed or deleted, rolling back the entire post save and reporting
that the author must insert the image again. If save wins, cleanup sees the committed
reference and preserves the file. Existing detached-image cleanup uses the same guarded
states for tracked assets while retaining its legacy behavior for older untracked files.

The grace period protects ordinary editing and Undo. An unsaved editor left open beyond
the grace period may need to reupload an expired image; there is no indefinite browser
lease. No image is deleted merely because a dialog closes or a block is removed locally.

The migration must run before deploying the new code. Production retains Cron configuration; the legacy dev schedule remains only during
Preview rollout. The staging Preview calls the same function through its protected
maintenance route and has no hourly schedule. Apply the migration through the existing reviewed release procedure
before merging to a deployment branch. CI migrates its disposable database only; it does
not apply migrations to deployed Neon branches. CI continues to own Worker deployments.

## Verification

- `npm run check`: formatting, ESLint, generated types, TypeScript and all 751 unit tests passed.
- Default SQL integration command: 83 tests across seven files passed without retries or
  skips, including both save/cleanup lock outcomes, rollback, query/fragment variants,
  unavailable-storage attachment checks and shared-image cleanup.
- Isolated upload browser/runtime suite: all seven cases passed, including removing an
  unsaved image, Undo, failed-save retry without another upload, and actual scheduled
  deletion of an expired pending image while preserving a fresh one.
- Full production browser suite: 334 passed with two configuration-dependent skips
  (configured cover controls and cover-link navigation). The separate upload suite
  verified configured storage and actual R2-binding behavior. No browser retries occurred.
- Both production and dev builds and deployment-target guards passed, including their
  hourly schedules. Only disposable local databases and simulated R2 were used.
