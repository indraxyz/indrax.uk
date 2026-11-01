# Inline images and card carousels

Branch: `feat/inline-images-card-carousels`, based on `develop`.

## Plan

1. Reuse the shared Tiptap image schema and verified upload pipeline for content images.
2. Add an accessible insert/edit dialog with a URL or file and independent alt text.
3. Extend local media serving and the existing transactional cleanup outbox to content assets.
4. Add Embla to the three existing card rails, preserving card sizes and print layouts.
5. Verify rendering, upload refusals, cleanup transactions, editor interactions and carousel
   navigation through unit, SQL integration and browser tests.
6. Run repository checks, review the diff, commit, push and open a PR into `develop`.

## Inline image specification

The article body supports multiple independent image blocks between paragraphs and other
blocks. The cover remains a separate post field. A toolbar action inserts an image at the
editor selection; selecting an existing image permits editing its URL and alt text or
removing it. The dialog traps focus, has named controls and returns focus on dismissal.
An empty alt value represents a decorative image.

Authors may enter an HTTPS image URL, preserving the existing authored-content policy,
or upload JPEG, PNG, WebP or AVIF up to 5 MiB. Uploads use
`POST /api/upload?purpose=content`, the existing author/Origin/signature/streaming checks,
and generated `content/<UUIDv4>.<extension>` keys. No additional credentials, storage
service, API route or database table is introduced. The storage availability flag already
used for covers also controls content upload availability; URL insertion remains available.

Uploads happen on the explicit image insertion action. Failed uploads retain dialog
input for retry. A successful upload followed by a failed post save remains in the
editor for retry without another upload. An abandoned unsaved upload may remain in
storage, as with the existing cover flow; there is no bucket-wide garbage collector.

Removed or replaced saved inline images and images belonging to deleted posts enter the
existing cleanup outbox in the same database transaction as the post mutation. Cleanup
deletes only generated keys belonging to the configured media storage, preserves other
posts' cover/content references and retains failed work for later retry. External image
URLs never grant deletion authority.

Local uploads use the isolated development R2 binding. The renderer resolves valid local
media URLs against the current development origin before sanitization; production still
rejects local HTTP image sources. Rendering policy changes increment the article renderer
cache version. Images fit the article width, preserve their aspect ratio, load lazily and
decode asynchronously so an image-heavy article does not block text rendering.

## Carousel specification

Embla applies to Home Writing, Resume Portfolio and Resume Tech Stack through their
shared `SectionCard` carousel path. Existing grids and article image blocks are unchanged.
Each rail has previous/next arrow controls aligned at the bottom right of its container,
with accessible section-specific names and disabled states at its boundaries. There is no
autoplay or looping. Touch dragging, keyboard operation, reduced motion, native scrolling
before hydration and existing print layouts remain supported.

The shared `CardCarousel` uses stable Embla 8.6 with start alignment and bounded
snaps. Each viewport is a named, focusable region; Left/Right arrows navigate it
and Home/End reach the boundaries. Keys inside nested card panes retain their
existing vertical scrolling behavior. Tab focus brings off-screen links into view.
Controls are 44 px targets outside the draggable viewport and remain disabled
when all cards fit. Reduced-motion preferences remove snap animation. Print CSS
resets the Embla transform and flows all cards into the existing two-column layout.

Draggable rails use grab/grabbing cursors; enabled arrows and links use a pointer.
The first card in a full-bleed rail starts at the normal page gutter, including on
the initial server render and hard refresh. Responsive leading padding belongs to
the moving track rather than the viewport: it scrolls away when navigating, so
cards can still reach both screen edges. Every resting snap uses the same resolved
gutter, and a matching trailing margin keeps the last column aligned with the right
container edge. Returning to the first snap restores the container-aligned first card.
The initial inset also works before hydration and without JavaScript. Gutter sizes
use the page's query-container width so nested card margins share the same value.

Browser coverage in `e2e/card-carousels.spec.ts`, `e2e/home-writing.spec.ts` and
`e2e/smoke.spec.ts` checks navigation boundaries, dragging, resize, card widths,
keyboard reachability, page overflow, print layout and the no-JavaScript fallback.

## Verification

- `npm run check`: formatting, lint, generated types, TypeScript and 730 unit tests passed.
- Default SQL integration command: 58 tests passed against an isolated loopback database.
  Multi-request cleanup tests have explicit 15-second budgets, consistent with the
  existing concurrency tests.
- Production browser coverage: 292 read tests passed, then 29 write tests passed when
  run serially without concurrent integration fixtures. Two configuration-gated cases
  were skipped: opening an editor from a configured cover and enabling configured
  storage controls. The initial combined SQL/browser run changed authoring post counts;
  the serial write rerun passed all cases that had failed or been blocked.
- Isolated development upload browser suite: all five tests passed, including actual
  multiple-inline-image upload, save, reload, preview, removal and post deletion.
- Production build and visual carousel review passed. No live deployment or remote
  database/storage writes were performed.
- Carousel alignment/cursor follow-up: all 15 focused browser tests passed without
  skips or retries, including 1–3 cards at 1440/1920 px, desktop/mobile resizing,
  drag cursors, navigation, printing and native scrolling. ESLint and TypeScript passed.
- Initial-render alignment follow-up: 32 carousel/home/smoke browser tests passed
  without skips or retries. Tests cover server-rendered alignment without JavaScript,
  hard refresh at 390/1920 px, first-snap alignment, and full-width movement after
  navigating. ESLint, TypeScript and the production build passed.
- Responsive snap alignment: all 22 focused carousel browser tests passed without
  skips/retries, including repeated Next, End and Home at 390/578/768/1440/1920 px.
  Resting columns match archive grid gutters, including the final column's right
  edge. A screenshot at 578 px after two Next actions was visually checked.
  ESLint, TypeScript and the production build passed.
