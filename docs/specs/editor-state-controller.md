## Problem and evidence

`features/writing/components/admin/post-form.tsx` combines rendering with a large stateful controller: editable/saved snapshots, state/ref mirrors, upload/save orchestration, refresh, status reconciliation, dirty navigation guards and autosave. The route passes controls to PostActions through a render prop. Extracting this controller makes ownership reviewable before considering Zustand.

## Scope / implementation plan

- Extract a feature-local controller hook from PostForm for working draft state, save/upload/refresh lifecycle, dirty navigation and autosave coordination.
- Reuse `post-form-state.ts`, `post-autosave.ts`, existing API DTOs, mutation cache helpers and TanStack Query. Extend pure transitions only when needed.
- Keep form DOM, slug caret restoration and presentation in PostForm; keep object URL creation/revocation associated with selected-file lifecycle. Preserve local dialog ownership or explicitly document necessary controller inputs.
- Preserve reusable PostActions for both editor and list contexts.
- Update authoring specification, architecture state ownership and test guidance.

## Out of scope

Zustand dependency, new authoring features, autosave policy changes, draft localStorage persistence, server/API/schema/cache redesign, URL/session state migration, Tiptap selection/history ownership, UI redesign and deployment.

## Acceptance criteria

- [ ] PostForm delegates orchestration to a dedicated feature hook with an explicit typed interface; presentation and controller responsibilities are documented.
- [ ] A save acknowledges the submitted snapshot and canonical server response without overwriting edits made in flight.
- [ ] Created post IDs survive later edits so a second save updates instead of creating another post.
- [ ] External status acknowledgements preserve unrelated dirty edits and independently selected statuses.
- [ ] A successful cover upload survives failed post saving and is reused on retry; selected-file replacement and URL cleanup remain correct.
- [ ] Autosave retains the 60-second dirty-only policy, latest-state reads, validation/status-transition guards, dialog/action/save/refresh exclusions and unmount cleanup.
- [ ] Refresh failure retains work; successful refresh replaces the snapshot, clears selected cover and remounts Tiptap. Fields remain locked during refresh.
- [ ] Dirty navigation/unload protections, external save button form association, live status, validation messages and slug caret behavior are preserved.
- [ ] No duplicate caches/API calls, browser/server boundary violations, new public bundle dependency or unnecessary abstractions.
- [ ] Checks pass; PR reports actual browser coverage and limitations.

## QA

Retain/extend `post-form-state.test.ts`, `post-autosave.test.ts`, `post-form.test.ts` and mutation-cache coverage. Hook-mocked render tests alone cannot establish lifecycle correctness.
Run `e2e/admin-sync.spec.ts` for clock-driven autosave, ID reuse, failures, refresh/discard/locking and request budgets; `e2e/admin-authoring.spec.ts` for edits during save, slug caret, cover controls and actions; relevant editor media/upload suites when those lifecycles change. Add focused intercepted-API lifecycle tests where DB-independent coverage is possible. Test post switching/unmount and no stale draft leakage.
Run `npm run check` and `npm run build`; follow disposable fixtures in `docs/testing.md`. Record skips/retries and do not read `.env.*` except `.env.example`.

## Delivery / rollback

Second in sequence after preference fixes; no technical code dependency on them. Branch `refactor` is not allowed by requested naming: use `feat/<issue-number>-editor-state-controller` off develop, PR into develop. Review as a behavior-preserving extraction. Revert the extraction to roll back; no migration.

## Related work

Sequence: #115 preference fixes → this controller extraction → #117 scoped-store evaluation. #115 is independently shippable; #117 depends on this extraction.
