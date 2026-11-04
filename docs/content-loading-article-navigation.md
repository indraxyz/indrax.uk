# Content loading and article navigation

Branch: `feat/content-loading-article-navigation`, created from synced `develop` and
including prerequisite PRs #96, #97 and #98. PRs #96/#97 were subsequently merged in
that order after the approved migration `0007_media_upload_lifecycle` was applied and
verified on Neon develop. PR #98 remains the pending UX prerequisite.

## Plan

1. Reuse existing TanStack Query states, public/admin components and sanitized article
   heading data; add shared skeleton and image-loading primitives where useful.
2. Show shape-matched skeletons while initial content is pending on home Writing, the
   Writing archive, admin dashboard, and admin posts cards/table. Preserve empty/error
   states and cached content during background refreshes.
3. Keep meaningful loading announcements in one status region; hide decorative skeletons
   from assistive technology, mark pending containers busy, and honor reduced motion.
4. Show a soft blurred image-loading surface until image load/decode completes on public
   and admin covers and content images. Preserve dimensions, alt text, native lazy loading,
   failed-image recovery, cached images and readable no-JavaScript public content. Do not
   fetch images twice or invent low-resolution image URLs.
5. Extend the existing article TOC to heading levels h2–h4 with meaningful hierarchy. Use
   the shared ArticleCard for published and preview pages: a left sidebar on desktop and
   a compact sticky disclosure on tablet/mobile, coordinated with visible-header offsets.
   Preserve native anchors, keyboard access, heading clearance, print and no-JavaScript use.
6. Replace visible formatting-toolbar scrollbars with pointer dragging, retain touch/native
   scrolling and keyboard-operable buttons, distinguish a drag from a click, and show
   left/right gradient cues only while there is content in that direction. Preserve media
   resizing, editor selection, overflow menus and reduced-motion behavior.
7. Cover delayed/error/cached loading, skeleton layouts, image lifecycle, TOC heading
   hierarchy/responsiveness/focus, and toolbar drag/click/keyboard boundaries in unit and
   browser tests. Inspect screenshots, run repository checks, and open a PR into develop.

## Implementation boundaries

Keep current API and authentication contracts. Do not add an image service, analytics,
extra data pipeline or schema migration. The approved prerequisite migration was applied
to develop separately from these UX changes. Each component's normal loaded markup
and semantics remain authoritative; skeletons are transient placeholders.

## Implementation and verification

- Skeletons use one live status outside an `aria-busy` subtree; decorative card/table
  geometry is hidden from assistive technology. Destination queries mount after access
  verification, while cached data remains visible on background refreshes.
- Nonblocking progress replaces the former public query overlay. Admin boot/session
  verification retains its spinner. Slow searches remain interactive and commit their
  destination URL before results arrive; clearing and Back preserve that history.
- One image lifecycle enhancement observes native images, including sanitized article HTML,
  editor node views and portal previews. It handles load/decode, cached sources, replacement,
  errors and stale decode completion. Explicit editor dimensions reserve saved aspect ratios.
- Contents reuse the existing sanitized heading IDs and include h2–h4 in a nested tree.
  Target margins reserve full navigation height, while sticky positioning uses its visible
  height. Rendered article cache version is 4. Native disclosure/anchors survive without JS.
- Both formatting rows use the shared drag-scroll primitive. Scrollbar hiding does not
  remove native touch scrolling, button focus, keyboard boundaries or overflow cues.

Validation:

- `npm run check` passed formatting, ESLint, generated Worker/route types, TypeScript and
  864 unit tests across 81 files. Changed browser-test files also passed final formatting/lint.
- All 192 affected browser cases were verified: the final broad run passed 188 cases;
  four existing smoke cases encountered browser storage-write/target crashes. All four
  passed in an isolated single-worker rerun with tracing disabled. No cases were skipped
  and no automatic retries were used.
- Earlier integration runs exposed and fixed the blocking progress overlay, unloaded editor
  dimensions, upward contents clearance and two assertions tied to the old navigation
  timing. The deliberately delayed-image fixture now waits for DOM readiness instead of
  the image's withheld load event; stale decode and failed-source recovery both pass.
- Desktop/mobile skeletons, admin dashboard/table, article contents and toolbar gradients
  were captured and visually inspected. Existing resize, filter, navigation, carousel,
  print and light/dark axe coverage passed alongside the new cases.
- Migration 0007's ledger hash matches the committed SQL. Its table, cleanup index and
  enabled attachment trigger were verified on Neon develop before merging #96 then #97.
  Local develop was synced to the remote merge revision; production was not modified.
