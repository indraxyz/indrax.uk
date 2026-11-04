# Navigation and carousel UX

Branch: `feat/consistent-carousels-scroll-navigation`, based on `develop` and including
the prerequisite work in PRs #96 and #97.

## Carousel plan

1. Move the home Writing rail's responsive card width into shared UI infrastructure.
2. Apply that width to Resume Tech Stack and Portfolio, with the same surface feedback.
3. Make Portfolio use the same full-width viewport and container-aligned gutters.
4. Keep bounded resume cards, named keyboard-scrollable detail panes and print columns.
5. Cover mobile/desktop sizing, alignment, hover/focus, keyboard navigation and print behavior
   in the existing browser specifications.

## Carousel specification

Home Writing, Resume Tech Stack and Resume Portfolio use the same responsive rail width:
one column below `sm`, two at `sm`, and three at `lg`, matching the Writing archive grid.
The shared `SectionCard` owns full-bleed sizing and print resets whenever its existing
`carouselFullBleed` option is enabled. The first card and every resting snap align to the
page gutter, while dragging retains access to both viewport edges.

All three card types share shadow feedback on hover and focus within. Keyboard focus keeps
its existing visible outline, and reduced-motion preferences disable the shadow transition.
Tech Stack remains informational; Portfolio keeps its explicit, named GitHub link and
independent scrollable details. Both resume rails retain bounded card heights, accessible
previous/next controls, native scrolling before hydration, and the existing two-column print
layout. No autoplay or new card-wide links are introduced.

## Navigation plan and specification

Use one shared sticky `ScrollHeader` in public and admin shells. After scrolling past
its own height, 12 px of downward movement slides the header up; upward movement reveals
it. Direction changes below that threshold do not flicker the header. At the top it always
remains visible, and elastic overscroll cannot reverse the detected direction.

The header keeps its document-flow space and semantic navigation. Focus reveals it, and
keyboard-visible focus keeps it visible; pointer focus does not prevent scrolling from
hiding it. Admin dropdowns and the mobile drawer also pin it open. Route
changes reset it. Scroll listeners are passive, updates are scheduled once per animation
frame, and listeners/frames are cleaned up when unmounted. Reduced motion disables the
transition. Print and the public no-JavaScript fallback keep navigation visible.

Verify actual scrolling, visible geometry, focus recovery, menu pinning, route changes,
pointer-focus scrolling, reduced motion and print in Playwright across mobile and desktop
public/admin pages.

## Stack content plan and specification

Reconcile the Stack page with the implementations merged in PRs #96/#97 and the shared UX
changes. Explain Base UI, responsive Embla rails, inline images, YouTube embeds, proportional
resizing, alignment and the managed-upload lifecycle. Distinguish cover uploads on Save
from inline uploads on insertion. Describe hourly abandoned-upload expiry after 24 hours
and preservation of referenced media. Keep the existing typed content model and disclosures.

## Validation and shipping

Run formatting, ESLint, generated types, TypeScript and the unit suite, then the browser
suite against built public/admin Worker artifacts. Inspect screenshots of the changed
layouts. Record skips/retries explicitly. Commit and push without agent co-author trailers,
and open a PR into `develop`. Existing PR merges require the committed database migration
on Neon develop before CI can deploy Preview; production is outside this change.

## Verification results

- `npm run check` passed: Prettier, ESLint, generated Worker/route types, TypeScript and
  854 unit tests across 79 files.
- The eight affected browser specifications passed all 103 cases with no skips or retries,
  including axe checks in light/dark themes, responsive cards, print/native scrolling,
  public/admin navigation and existing smoke checks.
- A final review added a pointer-focus regression: mouse-focused header links must not
  prevent hiding during scroll. After rebuilding, all 25 navigation/current-navigation
  cases passed, including both pointer regressions, with no skips or retries.
- Desktop (1440 px) and mobile (390 px) screenshots were visually inspected.
- Initial browser assertions were corrected to test disabled transitions instead of an
  exact duration overridden by global reduced-motion CSS, and to await drawer trigger
  focus restoration. A shared-output collision affected four smoke traces in the initial
  run; the complete 103-case rerun used isolated output and passed.
- Initial read-only Neon verification found develop migrated through `0006_cover_cleanup`,
  with `0007_media_upload_lifecycle` pending. After operator approval on November 4, the
  committed Drizzle migration was applied atomically to Neon develop and its ledger hash,
  table, cleanup index and enabled attachment trigger were verified. PR #96 was then merged
  before #97. Production was not changed.

## Sticky controls follow-up plan and specification

The archive filter bars and editor formatting toolbar previously measured the full header
height independently. Once navigation hid, this left an empty header-sized gap above sticky
controls, showing moving page content through the gap.

1. Make `ScrollHeader` own one measured, shell-scoped `--site-header-offset`: header height
   while visible and zero while hidden. Keep the value updated when navigation wraps.
2. Let both archive filter bars and the editor formatting toolbar consume that offset,
   replacing their separate header measurements. Their top-position transitions follow
   the header's timing and honor reduced motion.
3. Preserve full-width archive backgrounds, stacking order, control focus, responsive
   widths and normal document flow. Print keeps controls in normal flow.
4. Reproduce the gap with browser geometry assertions before the fix, then verify scrolling
   down/up, keyboard focus, viewport resizing, reduced motion and the editor's long-content
   sticky boundary against built Worker assets.
5. Run repository checks, inspect screenshots, and push the fix to the existing UX PR #98.

Sticky-controls verification:

- The updated mobile regression failed against the old build with a 122 px gap; a desktop
  Chromium measurement reproduced a 78 px gap.
- After the fix, desktop/mobile measurements place the archive toolbar at 0 px with the
  header hidden and exactly at its visible bottom after upward scrolling. Screenshots of
  both states were visually inspected.
- All 110 affected browser cases passed with no skips or retries: public/admin filters,
  long-article formatting controls, navigation, inline-image/video editor regressions and
  light/dark accessibility audits. The editor tests sample 18 animation frames and verify
  no more than 2 px of separation during header reveal.
- The repository check passed formatting, lint, generated types, TypeScript and all 854
  unit tests. This follow-up changes no database schema or remote resources.
