# Scoped editor state evaluation

Issue: [#117](https://github.com/indraxyz/indrax.uk/issues/117).
Predecessor: [controller extraction #119](https://github.com/indraxyz/indrax.uk/pull/119).

## Scope

Measure the extracted editor using deterministic short and long documents. Compare
its existing rendering with a temporary React memoization/stable-callback boundary
before introducing another state library. Ship a reproducible experiment and the
adopt/defer decision. The experiment modifies only a private source copy.

If Zustand is justified later, use one vanilla store per mounted editor, provided
through context with narrow subscriptions. TanStack Query continues to own server
responses, Tiptap owns selection/history, and local DOM resources retain their
component lifecycle. Preserve existing save reconciliation, created-ID reuse,
autosave guards, refresh/discard, upload retry and navigation behavior.

## Out of scope

No global site store, URL/session/cache migration, persistent private drafts, new
editor features, UI redesign, production instrumentation or live deployment.
A temporary comparator is not a production optimization and does not demonstrate
Zustand performance.

## Acceptance criteria

- Record the source revision and hashes, browser/runtime/build conditions, fixture
  sizes, sample count and raw observations.
- Distinguish committed render counts, serialization time and input-to-frame
  latency; do not call these React render durations or production INP.
- Fail the experiment on browser errors, unexpected API requests, mutations or
  missing input samples. All API traffic uses local intercepted fixtures.
- Compare short/long body and metadata typing with the same instrumentation.
- Record an evidence-based adopt/defer decision and limitations without adding a
  dependency merely to complete the ticket.
- Keep the benchmark outside application entry points; no changed runtime or
  user-facing state ownership. Required formatting/lint/types/unit/build checks
  still apply to the tooling PR.

## QA and rollback

Run both experiment variants against the same extracted-editor revision, with
seven fresh-page samples per document/action combination. Inspect the raw counts
and request records; report medians and nearest-rank p95. These are diagnostic
observations, not an unstable CI timing threshold. Repeat measurements if the
controller, Tiptap integration or representative document shape changes.

The controller PR separately validates real editor behavior through unit and
browser lifecycle tests. This tooling-only ticket does not substitute synthetic
measurements for authentication, storage-upload or screen-reader validation.
Reverting the script and evidence documentation rolls back this ticket.
