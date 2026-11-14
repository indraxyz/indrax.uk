# Writing interactions and authoring improvements

## Plan and scope

Ship separately from the Workers Previews production release, branching from
develop. Reuse existing writing APIs, TanStack Query, shared article/card UI,
PostForm save lifecycle, Drizzle and the Worker request boundaries.

1. Update stack descriptions to match current deployment, analytics and authoring.
2. Share a two-tag disclosure across public writing cards, articles and previews.
3. Add canonical-link copying and persistent reader reactions to public articles.
4. Refresh admin lists and editor data without reloading the document.
5. Save valid changed drafts every 60 seconds through the existing mutation.

## Acceptance criteria

- Zero to two tags render normally. More tags show the first two and a keyboard
  accessible +N button. Expansion reveals all tags and can be reversed without
  navigation. The control matches badge height; its expanded state is a minus icon
  with an accessible collapse label. Each instance has independent state; tag links
  remain actionable.
- Copy-link action copies only the canonical published URL and uses an accessible
  toast for success/failure. Its share icon stays unchanged and no inline feedback
  alters the header. It does not expose preview tokens. Actions have accessible names,
  visible focus, touch targets and mobile wrapping consistent with current UI.
- Reactions support love, noted, thumbs up, fire and rocket with public counts.
  Anonymous readers may select multiple emoji and toggle
  each once per browser. Desired-state requests are idempotent; writes require
  same origin, bounded JSON, strict validation and rate limiting. Drafts,
  archived, scheduled and missing posts cannot be read or reacted to. Counts do
  not require article SSR queries or invalidate rendered-content caches.
- An Add reaction icon immediately left of Share opens the emoji picker. Selecting
  an option closes it and restores focus. Only positive-count reactions appear
  below metadata and above tags, as plain borderless/background-free emoji plus
  counts (14px emoji, 12px count at default root size). Header rows use uniform
  spacing without stacking CardHeader sibling margins and gaps.
- Previous/Next links preserve filters and ordinary link behavior. After destination
  results arrive, focus moves to the list and it scrolls smoothly below sticky
  navigation/filters; reduced motion uses instant scrolling. Back/Forward retain
  native scroll restoration and ordinary refreshes do not steal focus.
- Saves return the canonical AdminPost snapshot in the POST response and seed the
  detail cache. No follow-up detail GET is needed, including new-draft navigation.
  Response normalization must retain fields edited while a save was in flight.
  Status changes return minimal metadata and patch existing cached detail without
  incorrectly marking an old body fresh. Mounted lists still refetch when needed
  for server filtering/order/counts; inactive collections are only marked stale.
- Tag option queries run when Filters opens, reuse fresh cached options and allow
  explicit retry. Closed-sheet visits and pagination do not fetch unused options.
- Browser reaction identity is functional storage created on first interaction;
  no fingerprinting, IP storage or analytics consent coupling. Browser storage
  removal permits a new identity; this is a lightweight engagement count.
- Admin status displays use readable text with a 3px design-token underline: light
  green (`brand-500`) for published, orange for draft, dark green (`brand-800`) for
  archived. Cards and table share one
  status component; color is supplementary to the text.
- Admin list refresh sits immediately right of Filter in its button group,
  requests only current post results and preserves filters, sorting and page.
  Pending/error feedback remains accessible and cached results survive errors.
- Editor refresh appears in its actions menu for persisted posts. Dirty forms
  require discard confirmation. Success replaces metadata, tags, cover and editor
  document and resets dirty state; errors preserve current work. Refresh and saves
  cannot overlap or overwrite edits made during a fetch.
- Every 60 seconds, valid dirty drafts save once. Clean, invalid, busy or refreshing
  forms do not write. New forms start draft and retain their created ID. In-flight
  edits remain dirty. Failures retain edits and show retryable feedback.
- Only drafts autosave. Published and archived edits require manual Save. Status
  transitions require the existing manual confirmation and are never automatically
  submitted. Timer cleanup runs on unmount.

## QA and release

- Unit coverage: disclosure output, canonical copying behavior, reaction
  validation and desired-state semantics, public visibility, request boundaries,
  autosave eligibility and dirty snapshot handling.
- Database integration: reaction uniqueness, counts, removal, visibility and
  atomic desired-state writes against a disposable local database.
- Browser coverage: keyboard tag expansion/collapse and card overlays; clipboard
  success/failure; reactions and reload persistence; filtered list refresh;
  editor discard/cancel/error; clock-driven dirty/clean autosave and new-post ID
  reuse; mobile layout and accessibility checks.
- Run repository check, production/staging builds and relevant browser suites.
  Report fixture skips and retries. Inspect final diff for duplicate flows,
  boundary violations, dead code and documentation drift.
- Any new schema uses a committed Drizzle migration. Apply it to staging before
  feature merge and production before the later feature release. This feature PR
  does not deploy or migrate production.

## Operational limits

Existing authoring uses last-write-wins across tabs. This work serializes requests
within a form; atomic cross-tab revision conflicts require a separate contract.
The retained old dev Worker and shared staging resources remain untouched.

## Editor state ownership

`use-post-form-controller.ts` owns the working draft, saved baseline, upload/save and
refresh orchestration, dirty navigation protection and autosave. Its confirmation
flags gate autosave; `PostForm` renders their dialogs and owns focus, slug caret
restoration and selected-file object URL cleanup. The edit route keys each form by
post ID, so changing posts creates a fresh controller. TanStack Query remains the
server cache and Tiptap owns selection/history. No draft is persisted in browser
storage. See [the controller specification](editor-state-controller.md).
