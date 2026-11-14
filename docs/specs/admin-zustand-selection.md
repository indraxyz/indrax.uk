Issue: [#121](https://github.com/indraxyz/indrax.uk/issues/121).

## Objective

Use Zustand for admin display preferences, coordinated navigation/drawer state, and current-page post selection with explicitly confirmed bulk actions. Reuse the existing CSR admin, UI primitives, TanStack Query, status APIs and cache invalidation helpers.

## Plan and scope

1. Introduce narrowly subscribed admin-only stores. Migrate cards/table preference while retaining raw storage key/value compatibility, cross-tab events and failed-storage fallback. Keep theme/consent helpers unchanged.
2. Coordinate mobile drawer and desktop/mobile Public menus through explicit navigation state. Header remains pinned whenever any menu is open. Close on navigation/breakpoint changes and reset transient state at sign-out/session loss.
3. Add accessible selection to card and table layouts, select-all/mixed state, selected count, clear and confirmed bulk actions. Selection is restricted to current loaded page; reset on URL criteria/page changes and departure, prune removed IDs, never persist selection or include placeholder/hidden rows.
4. Use existing per-post APIs sequentially with bounded work, explicit partial success reporting, no false atomicity, retry failed IDs only and no duplicate in-flight submissions. Stop subsequent work on expired authorization. Keep query data in TanStack Query and invalidate/seed through existing helpers.
5. Owner-confirmed bulk actions: Publish, change to Draft and Archive, restricted to the current page. No bulk permanent delete. Skip posts already in the target status; confirm the count of actual changes and report skipped items. Publishing warns that eligible content becomes publicly available.

## Out of scope

Editor draft migration, public Zustand imports, global server-data copies, new database schema or bulk API pipeline, cross-page/select-all-results, background operations, new preference controls, production deployment and manual environment changes.

## Acceptance criteria

- [ ] Zustand is installed with npm/lockfile and used for all three requested admin state areas, with narrow selectors and explicit store lifecycles.
- [ ] Existing cards/table persistence, raw values, cross-tab synchronization, storage failure fallback and first-paint behavior remain compatible.
- [ ] Drawer/menu focus, Escape, route closing, breakpoint changes, header pinning and accessible labels remain correct.
- [ ] Card/table selection stays synchronized across view switches; only current authoritative result IDs can be acted on. URL change, leaving page and session end reset selections.
- [ ] Select-all conveys mixed state; controls have keyboard access, meaningful labels, visible focus and usable touch targets. Count/result announcements are not duplicated.
- [ ] Bulk mutation requires confirmation listing action/count; pending guards block duplicate work. Partial failures retain eligible failed selections and describe successes/failures. Session expiry stops further writes.
- [ ] Server authorization/origin checks and cache invalidation remain authoritative; no private state persists or leaks between sessions.
- [ ] Existing per-post actions and archive navigation continue working. No unsupported performance claim.
- [ ] Spec/docs, unit/browser coverage, formatting/lint/types/build pass; skips and retries reported.

## QA

Store tests: isolated instances, selection toggle/select-all/pruning/reset, pending guards, relevant subscriptions, cross-tab storage changes and denied storage. Bulk orchestration tests: success/partial failure/retry, thrown transport error, authorization expiry, no duplicates and existing cache reconciliation.
Browser: mocked admin API fixtures in cards/table, view switching, selection across criteria/page/refresh/navigation, confirmation cancellation, partial result feedback, keyboard/mixed state, menu route/breakpoint/Escape behavior and header pinning. Retain real authoring/session/upload suites and report prerequisite skips.
Run npm run check, npm run build, focused Playwright specs and diff sanity check. No .env.* reads except .env.example.

## Delivery

One feat/<ticket>-admin-zustand-selection branch from current develop, one PR into develop, no agent co-author trailer. Ship commit/push/open PR only; merging is outside this new request. Rollback reverts application/dependency changes together; preserve existing storage format.
